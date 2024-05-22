import { fetchStale } from '../core/utils/fetch.util.js';
import { proxyRoute } from '../core/utils/proxy.util.js';

export const proxyCoffeeRoute = proxyRoute(
  '/proxy-coffee',
  'https://coffee.alexflipnote.dev/random.json',
);

export const coffeeRoute = {
  path: '/coffee',
  handler: async () => {
    const coffeeData = await fetch(
      'https://coffee.alexflipnote.dev/random.json'
    ).then(r => r.json());
    return new Response(JSON.stringify(coffeeData));
  }
};

export const freshCoffeeRoute = {
  path: '/fresh-coffee',
  cache: false,
  handler: async () => {
    const coffeeData = await fetch(
      'https://coffee.alexflipnote.dev/random.json'
    ).then(r => r.json());
    return new Response(JSON.stringify(coffeeData));
  }
};

export const staleCoffeeRoute = {
  path: '/stale-coffee',
  cache: false,
  handler: async () => {
    return fetchStale(
      'stale-coffee',
      'https://coffee.alexflipnote.dev/random.json'
    );
  }
};

export const staleCoffee2Route = {
  path: '/stale-coffee-2',
  cache: false,
  handler: async () => {
    const coffeeData = await fetchStale(
      'stale-coffee-2',
      'https://coffee.alexflipnote.dev/random.json'
    ).then(r => r.json());
    return new Response(JSON.stringify(coffeeData));
  }
};