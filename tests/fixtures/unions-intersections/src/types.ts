type Success = {
  ok: true;
};

type Failure = {
  ok: false;
  message: string;
};

type Result = Success | Failure;

type A = {
  a: string;
};

type B = {
  b: number;
};

type Combined = A & B;

