export const enum CatCode {
  Invalid = -1,
  Escape = 0,
  LeftBrace,
  RightBrace,
  MathShift,
  TabMark,
  CarRet,
  MacParam,
  SupMark,
  SubMark,
  Ignore,
  Spacer,
  Letter,
  OtherChar,
  ActiveChar,
  Comment,
  InvalidChar,
}

export const enum GroupType {
  Bottom = 0,
  Simple,
  SemiSimple,
  MathShift,
  DoubleMathShift,
}
