// @ts-check

// In order to check how GitHub formats a particular count, check the advanced
// search results for a particular star count, e.g.
// https://github.com/search?q=stars%3A999..999&type=Repositories
export const formatCount = count => {
  if (count < 1000) {
    return `${count}`;
  }
  const hundreds = Math.round(count / 100);
  const result = `${hundreds / 10}k`;
  if (result.length < 6) {
    return result;
  } else {
    // e.g. 100.1k, need to drop the decimal part.
    return `${(hundreds / 10).toFixed(0)}k`;
  }
};
