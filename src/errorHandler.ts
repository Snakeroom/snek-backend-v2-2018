import Hapi from "hapi";
import Boom from "boom";

export default (req: Hapi.Request, reply: Hapi.ResponseToolkit) => {
	const res = req.response!;
	if (res instanceof Boom) {
		req.yar.set("error", res["message"]);
		return reply.redirect(req.yar.get("origin", true) || "/");
	}

	return reply.continue;
};
