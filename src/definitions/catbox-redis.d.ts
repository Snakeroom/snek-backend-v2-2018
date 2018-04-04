import { EnginePrototype } from "catbox";

declare module "catbox-redis" {
	const engine: EnginePrototype;
	export default engine;
}
