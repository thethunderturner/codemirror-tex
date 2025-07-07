import { ContextTracker} from '@lezer/lr';
import Context, { BottomContext } from './context';
import { GroupType } from './enums';
import * as Term from './gen/terms';

export class Tracker extends ContextTracker<Context | null> {
  constructor() {
    super({
      start: new BottomContext(),
      hash(ctx: Context | null) {
        return ctx ? ctx.hash : 0;
      },
      shift: (ctx: Context | null, term: number) => {
        return this.handleTerm(ctx, term);
      },
      reduce: (ctx: Context | null, term: number) => {
        return this.handleTerm(ctx, term);
      },
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private handleTerm(ctx: Context | null, term: number): Context | null {
    // If context is null, create a new bottom context
    if (!ctx) {
      ctx = new BottomContext();
    }

    switch (term) {
      case Term.left_brace: {
        return new Context(GroupType.Simple, ctx.depth + 1, ctx);
      }
      case Term.begingroup: {
        return new Context(GroupType.SemiSimple, ctx.depth + 1, ctx);
      }
      case Term.left_math_shift: {
        return new Context(GroupType.MathShift, ctx.depth + 1, ctx);
      }
      case Term.left_double_math_shift: {
        return new Context(GroupType.DoubleMathShift, ctx.depth + 1, ctx);
      }
      case Term.right_brace:
      case Term.endgroup:
      case Term.right_math_shift:
      case Term.right_double_math_shift: {
        return ctx.parent ?? ctx;
      }
      // read() bestaat niet in @lezer/lr

      // case Term.directive: {
      //   // For directives, we need to read the input differently
      //   // The exact method depends on how your grammar is structured
      //   // This is a placeholder - you'll need to adjust based on your grammar
      //   const start = stack.pos;
      //   const end = input.next; // or however you determine the end position
      //   const instructions = input.chunk(start, end).trim();
      //
      //   for (const dir of Object.values(directives)) {
      //     const updatedContext = dir.exec(instructions, ctx);
      //     if (updatedContext !== null) {
      //       ctx = updatedContext;
      //       if (!dir.fallthrough) break;
      //     }
      //   }
      //   break;
      // }
    }
    return ctx;
  }
}
