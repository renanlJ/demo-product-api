// Loaded via jest setupFiles before the app module is evaluated, so
// loadConfig() picks up the nock-mocked downstream URLs.
process.env.DETAILS_API_URL = "http://details.test";
process.env.REVIEWS_API_URL = "http://reviews.test";
process.env.RATINGS_API_URL = "http://ratings.test";
process.env.DOWNSTREAM_TIMEOUT_MS = "1500";
process.env.LOG_LEVEL = "silent";
