console.log(`Worker started up on ${(new Date()).toString()}.`);

/* XXX/NOW: Adapt this for the worker.
reddit.checkToken(token).then(newToken => {
	token = newToken;
	return reddit.guessKey(token, id, key).then(() => {
		return reddit.circleVote(token, id, 1).then(() => {
			return r
				.table("users")
				.filter({ accessToken: token })
				.update({
					assimilations: r.row("views").default(0).add(1)
				})
				.run(conn);
		});
	});
}).catch(() => {});
*/