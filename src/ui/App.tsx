import Main from "./Main/index";
import FakeGamePreview from "@/dev/FakeGamePreview";

function App() {
  const isFakeGamePreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("preview") === "fake-game";

  if (isFakeGamePreview) {
    return <FakeGamePreview />;
  }

  return (
    <>
      <div>
        <Main />
      </div>
    </>
  )
}

export default App
