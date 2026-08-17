// @ts-check

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
        stargazerCount
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

const endpoint = "https://api.github.com/graphql";
const timeoutMs = 30000;

// Failures attributable to the API (as opposed to bugs on our side), reported
// without a stack trace.
class APIError extends Error {}

const request = async (token, variables) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new APIError(
      `HTTP ${response.status} ${response.statusText}: ${JSON.stringify(payload, null, 2)}`
    );
  }
  if (payload?.errors) {
    throw new APIError(`API error: ${JSON.stringify(payload.errors, null, 2)}`);
  }
  return payload.data;
};

export async function getdata() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable not found");
  }
  try {
    const perPage = 100;
    const data = await request(token, { perPage });
    let page = data;
    while (page.viewer.repositories.pageInfo.hasNextPage) {
      page = await request(token, {
        perPage,
        cursor: page.viewer.repositories.pageInfo.endCursor,
      });
      data.viewer.repositories.nodes.push(...page.viewer.repositories.nodes);
    }
    return data;
  } catch (err) {
    if (err instanceof APIError || err.name === "TimeoutError" || err.name === "AbortError") {
      console.error(`error: ${err.message}`);
    } else {
      console.error(err);
    }
    return null;
  }
}
