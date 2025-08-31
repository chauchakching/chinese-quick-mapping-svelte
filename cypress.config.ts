import { defineConfig } from 'cypress';

export default defineConfig({
  screenshotOnRunFailure: false,
  video: false,

  e2e: {
    setupNodeEvents() {
      // implement node event listeners here
    }
  }
});
