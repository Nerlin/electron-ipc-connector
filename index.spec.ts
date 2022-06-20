import { connect, register } from "./index";

const module = {
  fn: () => "value",
  query: async () => 10.25,
  noop: () => {},
};

register(module);
register("namespace", module);

// @ts-expect-error
register("namespace", () => {});

const { fn, noop, query } = connect<typeof module>();
fn().then((value) => value.trim());
noop().then((value) => value === undefined);
query().then((value) => value === 10.25);

const namespace = connect<typeof module>("namespace");
namespace.fn().then((value) => value.trim());
namespace.noop().then((value) => value === undefined);
