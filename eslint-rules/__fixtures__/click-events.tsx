// Deliberately violates jsx-a11y/click-events-have-key-events
export function ClickableDiv() {
  return (
    <div
      onClick={() => {
        console.log("clicked");
      }}
    >
      Click me
    </div>
  );
}
