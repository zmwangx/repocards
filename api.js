// @ts-check

import { GraphQLClient, ClientError } from "graphql-request";

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

export async function getdata() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN environment variable not found");
  }
  const client = new GraphQLClient("https://api.github.com/graphql", {
    fetch: async (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
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
      data.viewer.repositories.nodes.push(...payload.viewer.repositories.nodes);
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError" || err.name === "FetchError") {
      console.error(`error: ${err.message}`);
    } else if (err.type === "system") {
      console.error(`error ${err.code}: ${err.message}`);
    } else if (err instanceof ClientError) {
      console.error(`API error: ${JSON.stringify(err.response.errors, null, 2)}`);
    } else {
      console.log(err);
      throw err;
    }
    return null;
  }
}
