import { register } from "./index";
import EventEmitter from "events";
import { connect } from "./browser";

const module = {
  fn: () => "value",
  query: async () => 10.25,
  noop: () => {},
  events: new EventEmitter(),
};

register(module);
register("namespace", module);

// @ts-expect-error
register("namespace", () => {});

const { fn, noop, query, events } = connect<typeof module>();
fn().then((value) => value.trim());
noop().then((value) => value === undefined);
query().then((value) => value === 10.25);
const unsubscribe = events.on("event", () => {});
unsubscribe();

const unsubscribeOnce = events.once("event", (value: string) => {});
unsubscribeOnce();

const namespace = connect<typeof module>("namespace");
namespace.fn().then((value) => value.trim());
namespace.noop().then((value) => value === undefined);
namespace.events.on("event", () => {});
