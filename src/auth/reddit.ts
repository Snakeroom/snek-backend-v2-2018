import qs from "querystring";
import fetch from "node-fetch";
import config from "../config";
import r, { conn } from "../db";

export interface User {
	accessToken: string;
	expiry: number;
	name: string;
	refreshToken: string;
	scope: string[];
}

interface TokenInfo {
	accessToken: string;
	expiry: number;
	refreshToken: string;
	scope: string[];
}

const scopes = ["identity", "vote"];
const authorizeUrl = "https://www.reddit.com/api/v1/authorize";
const tokenUrl = "https://www.reddit.com/api/v1/access_token";

const getHeaders = (accessToken?: string): { [key: string]: string } => {
	const headers = {
		"Content-Type": "application/x-www-form-urlencoded",
		"User-Agent": "sneknet v1.0.0"
	};
	if (accessToken) headers["Authorization"] = "bearer " + accessToken;

	return headers;
};

export const checkToken = async (accessToken: string) => {
	const user = await getUser({ accessToken });
	if (!user) throw new Error("user not found");

	if (Date.now() >= user.expiry - 10000) {
		const newToken = await getToken(user.refreshToken, true);
		await createOrUpdateUser({
			...user,
			...newToken
		});

		return newToken.accessToken;
	}

	return accessToken;
};

export const getUser = (filter: {}): Promise<User | undefined> => {
	return r
		.table("users")
		.filter(filter)
		.nth(0)
		.run(conn)
		.catch(() => undefined);
};

export const circleVote = async (
	accessToken: string,
	id: string,
	dir: number
) => {
	const body = {
		dir,
		id,
		isTrusted: true
	};

	return fetch(
		`https://oauth.reddit.com/api/circle_vote.json?${qs.stringify(body)}`,
		{
			method: "POST",
			headers: getHeaders(accessToken),
			body: qs.stringify(body)
		}
	).then(async res => {
		if (res.status === 200) return true;
		else throw new Error(res.status.toString());
	});
};

const createOrUpdateUser = (user: User) => {
	return r
		.table("users")
		.insert(user, {
			conflict: (_, oldDoc, newDoc) =>
				newDoc.merge({
					...oldDoc,
					scope: oldDoc("scope")
						.add(newDoc("scope"))
						.distinct()
				})
		})
		.run(conn);
};

export const getOrCreateUser = async (token: TokenInfo) => {
	const user: User = await fetch("https://oauth.reddit.com/api/v1/me", {
		headers: getHeaders(token.accessToken)
	}).then(res => res.json());

	user.accessToken = token.accessToken;
	user.expiry = token.expiry;
	user.refreshToken = token.refreshToken;
	user.scope = token.scope;

	await createOrUpdateUser(user);

	return user;
};

export const guessKey = async (
	accessToken: string,
	id: string,
	key: string
) => {
	const body = await fetch(
		"https://oauth.reddit.com/api/guess_voting_key.json",
		{
			method: "POST",
			headers: getHeaders(accessToken),
			body: qs.stringify({
				id,
				vote_key: key
			})
		}
	).then(res => res.json());

	return body[key];
};

export const getAuthorizeUrl = (state: string) => {
	return (
		authorizeUrl +
		"?" +
		qs.stringify({
			response_type: "code",
			client_id: config.reddit.clientId,
			redirect_uri: config.reddit.redirectUri,
			state: state,
			duration: "permanent",
			scope: scopes.join(" ")
		})
	);
};

export const getToken = (code: string, refresh = false) => {
	return fetch(tokenUrl, {
		method: "POST",
		headers: {
			...getHeaders(),
			Authorization: `Basic ${new Buffer(
				`${config.reddit.clientId}:${config.reddit.clientSecret}`
			).toString("base64")}`
		},
		body: qs.stringify(
			refresh
				? {
						grant_type: "refresh_token",
						refresh_token: code
				  }
				: {
						grant_type: "authorization_code",
						code: code,
						redirect_uri: config.reddit.redirectUri
				  }
		)
	})
		.then(res => res.json())
		.then(json => {
			if (json.error) throw new Error(json.error + ": " + json.message);

			return {
				accessToken: json.access_token,
				expiry: Date.now() + (json.expires_in * 1000),
				refreshToken: refresh ? code : json.refresh_token,
				scope: json.scope.split(" ")
			} as TokenInfo;
		});
};
