import type { APIRoute } from 'astro';
import { endpoint, HttpError } from '../../server/http';
import { authRoute } from '../../server/services/auth';
import { fitnessRoute } from '../../server/routes-fitness';
import { travelRoute } from '../../server/routes-travel';
import { readPhoto } from '../../server/services/travel';
import { searchLocations, nearbyLocations, exportLocations } from '../../server/services/locations';
import { json } from '../../server/http';
import { settingsRoute, dataRoute } from '../../server/routes-settings';
import { listWorkouts } from '../../server/services/fitness';
import { listTrips } from '../../server/services/travel';
import { fitnessSummary, travelDays } from '../../lib/analytics';
export const ALL: APIRoute = (context) =>
  endpoint(async () => {
    const path = context.params.path ?? '';
    if (path.startsWith('auth/')) return authRoute(context, path.slice(5));
    if (path.startsWith('fitness/')) return fitnessRoute(context, path.slice(8).split('/'));
    if (path.startsWith('travel/')) return travelRoute(context, path.slice(7).split('/'));
    if (path === 'locations' && context.request.method === 'GET')
      return json(await searchLocations(context.url.searchParams));
    if (path === 'locations/export' && context.request.method === 'GET') return exportLocations();
    if (path === 'locations/nearby' && context.request.method === 'GET')
      return json(await nearbyLocations(context.url.searchParams));
    if (path.startsWith('media/') && context.request.method === 'GET') {
      const [, id, variant] = path.split('/');
      return readPhoto(context.locals.user, id, variant);
    }
    if (path === 'settings') return settingsRoute(context);
    if (path.startsWith('data/')) return dataRoute(context, path.slice(5));
    if (path === 'dashboard' && context.request.method === 'GET') {
      const [workouts, trips] = await Promise.all([
        listWorkouts(context.locals.user),
        listTrips(context.locals.user),
      ]);
      return json({
        fitness: fitnessSummary(workouts, context.locals.preferences),
        travel: {
          countries: new Set(trips.map((t) => t.location.country_code)).size,
          cities: new Set(trips.filter((t) => t.location.kind === 'city').map((t) => t.location_id))
            .size,
          trips: trips.length,
          days: travelDays(
            trips,
            Number(
              new Intl.DateTimeFormat('en', {
                year: 'numeric',
                timeZone: context.locals.preferences.timezone,
              }).format(new Date()),
            ),
          ),
          recent: trips[0] ?? null,
        },
      });
    }
    throw new HttpError(404, 'NOT_FOUND');
  });
