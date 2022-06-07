import { connect, expose, register } from "./index";

const module = {
  fn: () => "value",
  query: async () => 10.25,
  noop: () => {},
};

register(module);
register("namespace", module);

// @ts-expect-error
register("namespace", () => {});

expose(module);
expose(["fn"]);
expose<typeof module>(["fn", "noop"]);

// @ts-expect-error
expose<typeof module>(["unknown"]);
expose({
  namespace: module,
});
expose<{ namespace: typeof module }>({
  namespace: {
    fn: module.fn,
    query: module.query,
    noop: module.noop,
  },
});
expose<{ namespace: typeof module }>({
  // @ts-expect-error
  namespace: {
    fn: module.fn,
    query: module.query,
  },
});
expose({
  module,
  namespace: module,
});

const { fn, noop, query } = connect<typeof module>();
fn().then((value) => value.trim());
noop().then((value) => value === undefined);
query().then((value) => value === 10.25);

const namespace = connect<typeof module>("namespace");
namespace.fn().then((value) => value.trim());
namespace.noop().then((value) => value === undefined);
