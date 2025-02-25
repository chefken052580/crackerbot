export default {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"], // Point to your setup file
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy", // Mock CSS imports
  },
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest", // Use Babel for transforming JS/JSX files
  },
  transformIgnorePatterns: ["<rootDir>/node_modules/"],
};
