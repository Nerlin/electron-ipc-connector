import { connect, expose, register } from "./index";

const module = {
  fn: () => "value",
  noop: () => {},
};

register(module);
register("namespace", module);

// @ts-expect-error
register("namespace", () => {});

expose(module);
expose(["fn"]);
expose("namespace", module);
expose("namespace", ["fn"]);

const { fn, noop } = connect<typeof module>();
fn().then((value) => value.trim());
noop().then((value) => value === undefined);

const namespace = connect<typeof module>("namespace");
namespace.fn().then((value) => value.trim());
namespace.noop().then((value) => value === undefined);
