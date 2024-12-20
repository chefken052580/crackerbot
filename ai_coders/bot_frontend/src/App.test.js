import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import store from "./store"; // Ensure this imports the correct store
import App from "./App";

test("renders Redux Counter app", () => {
  render(
    <Provider store={store}>
      <App />
    </Provider>
  );

  const titleElement = screen.getByText(/Redux Counter/i);
  expect(titleElement).toBeInTheDocument();
});
