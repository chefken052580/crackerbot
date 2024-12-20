import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import store from "./store";
import App from "./App";

test("renders learn react link", () => {
  render(
    <Provider store={store}>
      <App />
    </Provider>
  );


  // Check if the heading is present
  const heading = screen.getByText(/redux counter/i);
  expect(heading).toBeInTheDocument();

  // Check if the initial value is displayed
  const value = screen.getByText((content, element) => {
    const hasText = (node) => node.textContent === "Current Value: 0";
    const nodeHasText = hasText(element);
    const childrenDontHaveText = Array.from(element?.children || []).every(
      (child) => !hasText(child)
    );
    return nodeHasText && childrenDontHaveText;
  });
  expect(value).toBeInTheDocument();

  // Check if the increment and decrement buttons are present
  const incrementButton = screen.getByText(/increment/i);
  expect(incrementButton).toBeInTheDocument();

  const decrementButton = screen.getByText(/decrement/i);
  expect(decrementButton).toBeInTheDocument();
});

