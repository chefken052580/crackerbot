import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { increment, decrement } from "../reducers/exampleReducer";

const Counter = () => {
  const dispatch = useDispatch();
  const value = useSelector((state) => state.example.value);

  return (
    <div className="p-4 bg-gray-100 rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Counter: {value}</h1>
      <div className="flex space-x-4">
        <button
          onClick={() => dispatch(increment())}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Increment
        </button>
        <button
          onClick={() => dispatch(decrement())}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Decrement
        </button>
      </div>
    </div>
  );
};

export default Counter;
