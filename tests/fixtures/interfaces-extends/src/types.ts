interface Parent {
  id: string;
}

type Value = {
  amount: number;
};

interface Child extends Parent {
  value: Value;
}

