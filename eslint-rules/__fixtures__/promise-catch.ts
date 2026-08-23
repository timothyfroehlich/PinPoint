// Deliberately violates promise/catch-or-return
export function unhandledPromise(p: Promise<string>) {
  p.then((val) => {
    console.log(val);
  });
}
