// const AsyncHandler = () => {}
// const AsyncHandler = (func) => { () => {} };
// const AsyncHandler = (func) => { async() => {} };
// const AsyncHandler = (func) => async() => {};

// I am taking a func as an argument and returning a function that handles the func we get in argument
const AsyncHandler = (func) => async (err, req, res, next) => {
  try {
    await func(err, req, res, next);
  } catch (error) {
    res.status(error.code || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// const AsyncHandler = (requestHandlerFunction) => {
//   return (err, req, res, next) => {
//     Promise.resolve(requestHandlerFunction(err, req, res, next)).reject((error) => next(error));
//   };
// };

export { AsyncHandler };
