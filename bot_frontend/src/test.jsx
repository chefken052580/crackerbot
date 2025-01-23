import React from "react";
import { render, screen } from "@testing-library/react";

const App = () => <h1>Hello, Vite is working!</h1>;

test("renders the heading", () => {
  render(<App />);
  const heading = screen.getByText(/Hello, Vite is working!/i);
  expect(heading).toBeInTheDocument();
});
