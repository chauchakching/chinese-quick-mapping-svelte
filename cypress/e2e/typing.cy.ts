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

    cy.viewport('iphone-6');
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

              // Verify input field is automatically focused
              cy.get('[data-testid="typing-input"]').should('be.focused');

              // === 5. Test Reset Button Auto-Focus ===
              // Type a character and then reset
              cy.get('[data-testid="typing-input"]').type('a');
              cy.get('[data-testid="reset-button"]').click();
              cy.wait(200);

              // Verify input field is automatically focused after reset
              cy.get('[data-testid="typing-input"]').should('be.focused');

              // === 6. Test Next Text Button Does NOT Auto-Focus During Typing ===
              // Type a character to start typing, then click next text
              cy.get('[data-testid="typing-input"]').clear().type('a');
              cy.get('body').click(); // Click elsewhere to remove focus
              cy.get('[data-testid="next-text-button"]').click();
              cy.wait(200);

              // Verify input field is NOT automatically focused when clicked during typing
              cy.get('[data-testid="typing-input"]').should('not.be.focused');

              // === 7. Test Cursor Position on Focus ===
              // Type some text and then click to focus again
              cy.get('[data-testid="typing-input"]').focus().clear().type('hello world');

              // Blur the input by clicking elsewhere
              cy.get('body').click();

              // Focus the input again by clicking on it
              cy.get('[data-testid="typing-input"]').focus();

              // Verify cursor is at the end of the text
              cy.get('[data-testid="typing-input"]').then(($input) => {
                const input = $input[0] as HTMLInputElement;
                expect(input.selectionStart).to.equal(input.value.length);
                expect(input.selectionEnd).to.equal(input.value.length);
              });
            }
          });
      }
    });
  });
});
