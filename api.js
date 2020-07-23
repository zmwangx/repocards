const { GraphQLClient, ClientError } = require("graphql-request");
const HttpsProxyAgent = require("https-proxy-agent");

// Supply fetch polyfill for graphql-request.
// https://github.com/prisma-labs/graphql-request/pull/127
if (!globalThis.fetch) {
  globalThis.fetch = require("cross-fetch");
}

// Support https_proxy env var.
// https://github.com/node-fetch/node-fetch/issues/195
const _fetch = globalThis.fetch;
globalThis.fetch = (url, options = {}) => {
  const instanceOptions = {
    ...options,
  };

  if (!options.agent && process.env.https_proxy) {
    instanceOptions.agent = new HttpsProxyAgent(process.env.https_proxy);
  }

  return _fetch(url, instanceOptions);
};

// Required scopes: public_repo.
const query = `
query ($perPage: Int!, $cursor: String) {
  viewer {
    login
    repositories(privacy: PUBLIC, ownerAffiliations: [OWNER, COLLABORATOR], isFork: false, orderBy: {field: STARGAZERS, direction: DESC}, after: $cursor, first: $perPage) {
      totalCount
      nodes {
        name
        owner {
          login
          ... on Organization {
            viewerIsAMember
          }
        }
        nameWithOwner
        description
        descriptionHTML
        primaryLanguage {
          name
          color
        }
        stargazers(first: 0) {
          totalCount
        }
        forkCount
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}
`;

module.exports = {
  getdata: async () => {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN environment variable not found");
    }
    const client = new GraphQLClient("https://api.github.com/graphql", {
      timeout: 5000,
      headers: {
        authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    });
    try {
      const perPage = 100;
      let payload = await client.request(query, { perPage });
      const data = payload;
      while (payload.viewer.repositories.pageInfo.hasNextPage) {
        payload = await client.request(query, {
          perPage,
          cursor: payload.viewer.repositories.pageInfo.endCursor,
        });
        data.viewer.repositories.nodes.push(
          ...payload.viewer.repositories.nodes
        );
      }
      return data;
    } catch (err) {
      if (err.name === "AbortError" || err.name === "FetchError") {
        console.error(`error: ${err.message}`);
      } else if (err.type === "system") {
        console.error(`error ${err.code}: ${err.message}`);
      } else if (err instanceof ClientError) {
        console.error(
          `API error: ${JSON.stringify(err.response.errors, null, 2)}`
        );
      } else {
        console.log(err);
        throw err;
      }
      return null;
    }
  },
};
