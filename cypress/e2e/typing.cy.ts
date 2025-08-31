describe('Typing Practice Page', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      // Ignore service worker and browser context errors in tests
      if (
        err.message.indexOf('Browser context management is not supported') !== -1 ||
        err.message.indexOf('Service Worker') !== -1
      ) {
        return false;
      }
      return true;
    });

    cy.visit('http://localhost:3000/typing');
  });

  it('should complete the full typing practice flow', () => {
    // === 1. Assert Initial UI ===
    cy.title().should('include', '打字練習');
    cy.get('[data-testid="typing-input"]').should('be.visible');
    cy.get('[data-testid="typing-stats"]').contains('速度:').should('be.visible');
    cy.get('[data-testid="reset-button"]').should('be.visible');
    cy.get('[data-testid="next-text-button"]').should('be.visible');

    // Wait for content to load
    cy.get('[data-testid="typing-char"]').should('have.length.greaterThan', 0);
    cy.get('[data-testid="typing-char"]').first().should('have.attr', 'data-char-state', 'current');

    // === 2. Start Typing and Assert Intermediate UI ===
    cy.get('[data-testid="typing-char"]').then(($spans) => {
      // Get first 3 Chinese characters
      const chineseChars = [];
      for (let i = 0; i < $spans.length && chineseChars.length < 3; i++) {
        const char = $spans.eq(i).text();
        if (/[\u3400-\u9FFF\uF900-\uFAFF]/.test(char)) {
          chineseChars.push(char);
        }
      }

      if (chineseChars.length >= 2) {
        // Type first character
        cy.get('[data-testid="typing-input"]').type(chineseChars[0], { delay: 100 });
        cy.get('[data-testid="typing-char"]')
          .first()
          .should('have.attr', 'data-char-state', 'completed');

        // Type second character
        cy.get('[data-testid="typing-input"]').type(chineseChars[1], { delay: 100 });
        cy.get('[data-testid="typing-stats"]').should('be.visible');

        // === 3. Complete the Typing and Assert Completion UI ===
        // Get full text and complete it
        cy.get('[data-testid="typing-text-display"]')
          .invoke('text')
          .then((fullText) => {
            cy.get('[data-testid="typing-input"]').clear();
            const chineseOnly = fullText.match(/[\u3400-\u9FFF\uF900-\uFAFF]/g)?.join('') || '';

            if (chineseOnly) {
              cy.get('[data-testid="typing-input"]').type(chineseOnly, { delay: 30 });
              cy.wait(1000);

              // Assert completion UI
              cy.get('[data-testid="completion-message"]').should('be.visible');
              cy.contains('完成！').should('be.visible');

              // Verify completion statistics
              cy.get('[data-testid="completion-message"]').within(() => {
                cy.contains('速度').should('be.visible');
                cy.contains('字/分鐘').should('be.visible');
                cy.contains('用時').should('be.visible');
                cy.contains('字數').should('be.visible');
              });

              // Input and live stats should be hidden
              cy.get('[data-testid="typing-input"]').should('not.exist');
              cy.get('[data-testid="typing-stats"]').should('not.exist');

              // === 4. Click Button to Continue with Another Test ===
              cy.get('[data-testid="next-text-button"]').click();
              cy.wait(500);

              // Verify new test is ready
              cy.get('[data-testid="typing-input"]').should('be.visible');
              cy.get('[data-testid="typing-stats"]').should('be.visible');
              cy.get('[data-testid="completion-message"]').should('not.exist');
              cy.get('[data-testid="typing-char"]')
                .first()
                .should('have.attr', 'data-char-state', 'current');
            }
          });
      }
    });
  });
});
