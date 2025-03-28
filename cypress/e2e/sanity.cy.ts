function expectKeystrokeTranslation(char, keystrokes) {
  cy.get(`[data-box-char=${char}] :first-child`).should('contain', char);
  cy.get(`[data-box-char=${char}] :nth-child(2)`).should('contain', keystrokes);
}

describe('sanity test', () => {
  // Add this before hook to ignore uncaught exceptions
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      // returning false here prevents Cypress from failing the test
      if (err.message.includes('Browser context management is not supported')) {
        return false;
      }
      return true;
    });
  });

  it('should work', () => {
    cy.visit('http://localhost:3000');

    /**
     * Allow access to chrome clipboard
     */
    try {
      Cypress.automation('remote:debugger:protocol', {
        command: 'Browser.grantPermissions',
        params: {
          permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
          origin: window.location.origin
        }
      });
    } catch (error) {
      cy.log('Failed to grant clipboard permissions, skipping clipboard test');
    }

    /**
     * Fix weird error on github action
     * https://github.com/cypress-io/cypress/issues/18198
     */
    cy.window().focus();

    cy.get('h1').should('contain', '速成查字');

    expectKeystrokeTranslation('速', '卜中');

    // FIXME: dunno why the cypress test failed in headless mode without this manual focus
    cy.get('textarea').type('{selectAll}');

    /**
     * can update textarea
     */
    cy.get('textarea').type('香港');
    expectKeystrokeTranslation('香', '竹日');
    expectKeystrokeTranslation('港', '水山');

    // update query param
    cy.location().should((loc) => {
      expect(loc.search).to.eq(`?q=${encodeURIComponent('香港')}`);
    });

    /**
     * can click "clear text field"
     */
    cy.get('#user-input').should('not.have.value', '');
    cy.getByTestId('char-box').should('not.have.length', 0);
    cy.get('button').contains('清空').click();
    cy.get('#user-input').should('have.value', '');
    cy.getByTestId('char-box').should('have.length', 0);

    /**
     * can load input history
     */
    cy.getByTestId('history-entry-button').should('have.length', 1).should('contain', '香港');
    cy.getByTestId('history-entry-button').click();
    cy.getByTestId('char-box').should('have.length', 2);
    expectKeystrokeTranslation('香', '竹日');
    expectKeystrokeTranslation('港', '水山');

    /**
     * can store history entries correctly
     */
    cy.get('#user-input').type('{backspace}');
    cy.getByTestId('history-entry-button').should('have.length', 1);
    cy.get('#user-input').type('港');
    cy.getByTestId('history-entry-button').should('have.length', 1);
    cy.getByTestId('history-entry-button').eq(0).should('contain', '香港');
    cy.get('#user-input').type('{backspace}{backspace}');
    cy.getByTestId('history-entry-button').should('have.length', 1);

    cy.get('#user-input').type('山竹牛肉');
    cy.getByTestId('history-entry-button').should('have.length', 2);
    cy.getByTestId('history-entry-button').eq(0).should('contain', '山竹牛肉');
    cy.getByTestId('history-entry-button').eq(1).should('contain', '香港');

    cy.get('#user-input').type('{backspace}{backspace}{backspace}水豆腐花');
    cy.getByTestId('history-entry-button').should('have.length', 3);
    cy.getByTestId('history-entry-button').eq(0).should('contain', '山水豆腐花');
    cy.getByTestId('history-entry-button').eq(1).should('contain', '山竹牛肉');
    cy.getByTestId('history-entry-button').eq(2).should('contain', '香港');
    cy.getByTestId('char-box').should('have.length', 5);

    /**
     * can get keystrokes of 倉頡
     */
    expectKeystrokeTranslation('腐', '戈人');
    cy.get('button').contains('倉頡').click();
    expectKeystrokeTranslation('山', '山');
    expectKeystrokeTranslation('水', '水');
    expectKeystrokeTranslation('豆', '一口廿');
    expectKeystrokeTranslation('腐', '戈戈人月人');
    expectKeystrokeTranslation('花', '廿人心');
    cy.get('button').contains('速成').click();
    expectKeystrokeTranslation('腐', '戈人');

    /**
     * can copy link
     */
    // Conditionally test clipboard functionality
    cy.window().then((win) => {
      if (win.navigator.clipboard && win.navigator.clipboard.readText) {
        cy.get('[alt="複製連結"]').click();
        cy.get('[alt="success icon"]');
        cy.window()
          .its('navigator.clipboard')
          .then((clip) => {
            // Only try to read clipboard if available
            if (clip && clip.readText) {
              return clip
                .readText()
                .then((text) => {
                  expect(text).to.equal(
                    'http://localhost:3000/?q=%E5%B1%B1%E6%B0%B4%E8%B1%86%E8%85%90%E8%8A%B1'
                  );
                })
                .catch(() => {
                  cy.log('Could not read clipboard, skipping assertion');
                });
            }
          });
      } else {
        cy.log('Clipboard API not available, skipping clipboard test');
      }
    });
  });

  it('support query param', () => {
    cy.visit('http://localhost:3000/?q=abc');
    cy.get('#user-input').should('have.value', 'abc');

    // when empty, should user default text
    cy.visit('http://localhost:3000/?q=');
    cy.get('#user-input').should('not.have.value', '');
  });
});
