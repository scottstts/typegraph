type TypeA = {
  id: number;
};

type TypeB = (arg1: string, arg2: number) => TypeA;

type TypeC = {
  id: string;
  count: number;
  content: TypeB;
};
