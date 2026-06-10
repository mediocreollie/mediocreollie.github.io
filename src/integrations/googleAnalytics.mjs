const DEFAULT_EXCLUDED_PATHS = ['/admin'];

export default function googleAnalytics({ measurementId, excludedPaths = DEFAULT_EXCLUDED_PATHS } = {}) {
	if (!measurementId) {
		throw new Error('googleAnalytics requires a GA4 measurementId.');
	}

	const escapedMeasurementId = JSON.stringify(measurementId);
	const escapedExcludedPaths = JSON.stringify(excludedPaths);

	return {
		name: 'google-analytics',
		hooks: {
			'astro:config:setup': ({ injectScript }) => {
				injectScript(
					'head-inline',
					`
const GA_MEASUREMENT_ID = ${escapedMeasurementId};
const GA_EXCLUDED_PATHS = ${escapedExcludedPaths};
const isExcludedFromAnalytics = GA_EXCLUDED_PATHS.some((path) =>
	window.location.pathname === path || window.location.pathname.startsWith(path + '/')
);

if (!isExcludedFromAnalytics && !window.__ga4Loaded) {
	window.__ga4Loaded = true;
	window.dataLayer = window.dataLayer || [];
	window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };

	const gaScript = document.createElement('script');
	gaScript.async = true;
	gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
	document.head.appendChild(gaScript);

	window.gtag('js', new Date());
	window.gtag('config', GA_MEASUREMENT_ID);
}
`
				);
			},
		},
	};
}
