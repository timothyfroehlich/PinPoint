// Deliberately violates react/exhaustive-deps
import { useEffect, useState } from "react";

export function TestComponent({ name }: { name: string }) {
  const [count] = useState(0);

  useEffect(() => {
    console.log(name, count);
  }, []);

  return <div>{count}</div>;
}
