import axios from 'axios';

const SEARCH_PROVIDER = process.env.SEARCH_PROVIDER || 'brave';

export async function webSearch(query, numResults = 5) {
  numResults = Math.min(Math.max(numResults, 1), 10);

  if (SEARCH_PROVIDER === 'serpapi') {
    return searchWithSerpApi(query, numResults);
  }
  return searchWithBrave(query, numResults);
}

async function searchWithBrave(query, numResults) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY is not configured');

  const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
    params: { q: query, count: numResults },
    timeout: 15000,
  });

  const results = (response.data.web?.results || []).slice(0, numResults);
  return results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description || '',
  }));
}

async function searchWithSerpApi(query, numResults) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error('SERPAPI_API_KEY is not configured');

  const response = await axios.get('https://serpapi.com/search.json', {
    params: { q: query, api_key: apiKey, num: numResults },
    timeout: 15000,
  });

  const results = (response.data.organic_results || []).slice(0, numResults);
  return results.map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || '',
  }));
}
