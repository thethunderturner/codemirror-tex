// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-plusplus, no-param-reassign, @typescript-eslint/no-shadow  */
// eslint-disable-next-line max-classes-per-file
import { ExternalTokenizer, InputStream } from '@lezer/lr';
import Context from './context';
import { CatCode, GroupType } from './enums';
import { Term } from './gen/terms';
import isHex from './utils/is-hex';

class State {
  // The current control sequence
  public cs!: string;

  // The current character
  public chr!: number;

  // The current command
  public cmd!: number;

  // The current location
  public loc!: number;

  // The current input buffer
  public buf!: InputStream;

  // The current context
  public ctx!: Context;

  // The current dialects
  public dct!: number;
}

export default class Tokenizer extends ExternalTokenizer {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  #state = new State();

  // Used for offsetting.
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  #offset = 2;

  constructor() {
    super(
      (input: InputStream, stack: any): number => {
        let dct = 0;
        if (stack.dialectEnabled && stack.dialectEnabled(Term.Dialect_tex)) {
          dct |= 1;
        }
        if (stack.dialectEnabled && stack.dialectEnabled(Term.Dialect_etex)) {
          dct |= 2;
        }
        if (stack.dialectEnabled && stack.dialectEnabled(Term.Dialect_pdftex)) {
          dct |= 4;
        }
        if (stack.dialectEnabled && stack.dialectEnabled(Term.Dialect_xetex)) {
          dct |= 8;
        }
        if (stack.dialectEnabled && stack.dialectEnabled(Term.Dialect_latex)) {
          dct |= 16;
        }
        if (stack.dialectEnabled && stack.dialectEnabled(Term.Dialect_directives)) {
          dct |= 1024;
        }

        this.#state.buf = input;
        this.#state.loc = input.pos;
        this.#state.chr = input.peek(0);
        this.#state.ctx = stack.context;
        this.#state.dct = dct;
        return this.getNext();
      },
      { contextual: true }
    );
  }

  private getNext(): number {
    this.#state.cmd = this.#state.ctx.catcode(this.#state.chr);
    switch (this.#state.cmd) {
      case CatCode.LeftBrace: return Term.left_brace;
      case CatCode.RightBrace: return Term.right_brace;
      case CatCode.TabMark: return Term.tab_mark;
      case CatCode.CarRet: return Term.car_ret;
      case CatCode.SubMark: return Term.sub_mark;
      case CatCode.Ignore: return Term.ignore;
      case CatCode.Spacer: return Term.spacer;
      case CatCode.Letter: return Term.letter;
      case CatCode.ActiveChar: return Term.active_char;
      case CatCode.OtherChar: return Term.other_char;
      case CatCode.MacParam: return Term.mac_param;
      case CatCode.InvalidChar: return Term.invalid_char;

      case CatCode.MathShift:
        if (this.nextIsMathShift()) {
          this.#state.loc += 1;
          return this.#state.ctx.groupType === GroupType.DoubleMathShift
            ? Term.right_double_math_shift
            : Term.left_double_math_shift;
        }
        return this.#state.ctx.groupType === GroupType.MathShift
          ? Term.right_math_shift
          : Term.left_math_shift;

      case CatCode.Escape:
        this.scanControlSequence();
        return this.#state.ctx.command(this.#state.cs);

      case CatCode.Comment:
        this.scanComment();
        return (this.#state.dct & 1024) > 0 && this.nextIsDirective()
          ? Term.directive_comment
          : Term.line_comment;

      case CatCode.SupMark:
        if (this.nextIsExpandedCharacter()) {
          this.scanExpandedCharacter();
          this.#state.loc += this.#offset;
          return this.getNext(); // recursive call, since the character was expanded
        }
        return Term.sup_mark;

      default:
        return -1; // fallback
    }
  }

  /**
   * Scans a control sequence.
   */
  private scanControlSequence() {
    if (this.#state.buf.peek(this.#state.loc - this.#state.buf.pos) === -1) {
      return;
    }

    // Get the first cs character and increment location.
    this.#state.chr = this.#state.buf.peek(this.#state.loc++ - this.#state.buf.pos);
    // Get the first character's category code
    this.#state.cmd = this.#state.ctx.catcode(this.#state.chr);
    // Add the current character to a number array.
    const cs = [this.#state.chr];

    // If the first cs character is a sup_mark, check for an expanded character and reduce before
    // continuing.
    if (this.#state.cmd === CatCode.SupMark && this.nextIsExpandedCharacter()) {
      this.scanExpandedCharacter();
      this.#state.loc += this.#offset;
      this.#state.cmd = this.#state.ctx.catcode(this.#state.chr);
      cs[0] = this.#state.chr;
    }

    // Return if the control sequence is a nonletter.
    if (this.#state.cmd !== CatCode.Letter) {
      this.#state.cs = String.fromCodePoint(...cs);
      return;
    }

    do {
      // Get the nth character and increment location.
      this.#state.chr = this.#state.buf.peek(this.#state.loc++ - this.#state.buf.pos);
      // Get the nth character's category code.
      this.#state.cmd = this.#state.ctx.catcode(this.#state.chr);
      // Add the nth character to the cs string.
      cs.push(this.#state.chr);

      // If the nth character is a sup_mark, check for an expanded character and reduce (or break) before
      // continuing.
      if (this.#state.cmd === CatCode.SupMark && this.nextIsExpandedCharacter()) {
        this.scanExpandedCharacter();
        this.#state.cmd = this.#state.ctx.catcode(this.#state.chr);
        if (this.#state.cmd === CatCode.Letter) {
          cs.push(this.#state.chr);
          this.#state.loc += this.#offset;
        }
      }
    } while (this.#state.cmd === CatCode.Letter);

    // Decrement location because the current location will always be the nonletter.
    this.#state.loc -= 1;
    // Pop the last element because this will always be the nonletter.
    cs.pop();
    // Set the control sequence.
    this.#state.cs = String.fromCodePoint(...cs);
  }

  /**
   * Reduces an expanded character, e.g. ^^? to \<delete\>.
   *
   * @returns - The code point encoded by the expanded character.
   */
  private scanExpandedCharacter() {
    this.#offset = 2;
    this.#state.chr = this.#state.buf.peek(this.#state.loc + 1 - this.#state.buf.pos);
    if (isHex(this.#state.chr)) {
      const cc = this.#state.buf.peek(this.#state.loc + 2 - this.#state.buf.pos);
      if (isHex(cc)) {
        this.#offset += 1;
        this.#state.chr = parseInt(`0x${String.fromCharCode(this.#state.chr, cc)}`, 16);
        return;
      }
    }
    this.#state.chr = this.#state.chr < 0o100 ? this.#state.chr + 0o100 : this.#state.chr - 0o100;
  }

  /**
   * Scans a comment.
   */
  private scanComment() {
    do {
      this.#state.chr = this.#state.buf.peek(this.#state.loc++ - this.#state.buf.pos);
    } while (this.#state.chr > -1 && this.#state.ctx.catcode(this.#state.chr) !== CatCode.CarRet);
  }

  /**
   * Checks if the comment is a directive.
   * @returns a flag
   */
  private nextIsDirective = (): boolean => {
    return this.#state.buf.peek(this.#state.loc - this.#state.buf.pos) === cp`!`;
  };

  /**
   * Checks if the next character is a math shift.
   * @returns a flag
   */
  private nextIsMathShift = (): boolean => {
    return this.#state.ctx.catcode(this.#state.buf.peek(this.#state.loc - this.#state.buf.pos)) === CatCode.MathShift;
  };

  /**
   * Checks if the next inputs make up an expanded character, e.g. ^^?.
   *
   * This only checks the characters after the first sup_mark, so a sup_mark check should be done
   * before calling this method.
   *
   * @returns a flag
   */
  private nextIsExpandedCharacter(): boolean {
    if (this.#state.ctx.catcode(this.#state.buf.peek(this.#state.loc - this.#state.buf.pos)) !== CatCode.SupMark) {
      return false;
    }
    const c = this.#state.buf.peek(this.#state.loc + 1 - this.#state.buf.pos);
    return c > 0 && c < 0o200;
  }
}
