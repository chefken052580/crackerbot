import { combineReducers } from "@reduxjs/toolkit";
import exampleReducer from "./exampleReducer";

const rootReducer = combineReducers({
  example: exampleReducer, // Add your example reducer here
});

export default rootReducer;
