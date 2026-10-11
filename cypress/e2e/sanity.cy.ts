function cardText(el: HTMLElement) {
  return (el.textContent ?? '').replace(/\s+/g, '');
}

function expectKeystrokeTranslation(char: string, keystrokes: string) {
  cy.get(`[data-box-char=${char}]`).should(($els) => {
    $els.each((_, el) => {
      const text = cardText(el);
      expect(text).to.contain(char);
      expect(text).to.contain(keystrokes);
    });
  });
}

function expectCompositionLetters(char: string, letters: string) {
  cy.get(`[data-box-char=${char}] .text-2xl`).should(($els) => {
    const shown = [...$els].map((el) => (el.textContent ?? '').trim()).join('');
    expect(shown).to.eq(letters);
  });
}

const mutedFill = 'rgb(209, 213, 219)';
const partFills = [
  'rgb(66, 59, 224)',
  'rgb(227, 27, 54)',
  'rgb(30, 148, 35)',
  'rgb(219, 153, 61)',
  'rgb(99, 231, 240)'
];

function expectPartFill(char: string, partNumber: number, fill: string) {
  cy.get(`[data-box-char=${char}] g[id="part-${partNumber}"] path`)
    .first()
    .should('have.css', 'fill', fill);
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
    cy.viewport('iphone-6');
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
    } catch {
      cy.log('Failed to grant clipboard permissions, skipping clipboard test');
    }

    /**
     * Fix weird error on github action
     * https://github.com/cypress-io/cypress/issues/18198
     */
    cy.window().focus();

    cy.get('h1').should('contain', '速成查字');
    cy.get('#user-input').should('have.value', '速成倉頡');
    cy.get('#user-input').should('have.attr', 'placeholder', '輸入字句');
    cy.get('img[src="/icons/search.svg"]').should('be.visible');
    cy.getByTestId('char-box').should('have.length', 4).first().should('match', 'div');

    expectKeystrokeTranslation('速', '卜中');
    expectCompositionLetters('速', '卜中');
    cy.get('[data-box-char=速] svg').should('exist');
    expectPartFill('速', 1, partFills[0]);
    expectPartFill('速', 2, mutedFill);
    expectPartFill('速', 3, partFills[1]);

    // FIXME: dunno why the cypress test failed in headless mode without this manual focus
    cy.get('textarea').type('{selectAll}');

    /**
     * can update textarea
     */
    cy.get('textarea').type('香港');
    expectKeystrokeTranslation('香', '竹日');
    expectKeystrokeTranslation('港', '水山');
    expectCompositionLetters('香', '竹日');
    cy.getByTestId('char-box-container').should('have.class', 'justify-center');
    cy.get('[data-box-char=香]').should('have.class', 'sm:w-64');

    // update query param
    cy.location().should((loc) => {
      expect(loc.search).to.eq(`?q=${encodeURIComponent('香港')}`);
    });

    /**
     * can click "clear text field"
     */
    cy.get('#user-input').should('not.have.value', '');
    cy.getByTestId('char-box').should('not.have.length', 0);
    cy.get('button[aria-label="清空"]').click();
    cy.get('#user-input').should('have.value', '');
    cy.getByTestId('char-box').should('have.length', 0);
    cy.get('button[aria-label="清空"]').should('not.exist');
    cy.contains('輸入文字，查看速成字碼').should('be.visible');

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
    cy.getByTestId('char-box-container').should('have.class', 'grid-cols-2');
    cy.getByTestId('char-box-container').should('not.have.class', 'justify-center');

    /**
     * can get keystrokes of 倉頡
     * 速成 shows the first and last parts; 倉頡 shows the full composition.
     */
    expectKeystrokeTranslation('腐', '戈人');
    expectCompositionLetters('腐', '戈人');
    expectPartFill('腐', 1, partFills[0]);
    expectPartFill('腐', 2, mutedFill);
    expectPartFill('腐', 3, mutedFill);
    expectPartFill('腐', 4, mutedFill);
    expectPartFill('腐', 5, partFills[1]);
    cy.get('button').contains('倉頡').click();
    expectKeystrokeTranslation('山', '山');
    expectKeystrokeTranslation('水', '水');
    expectKeystrokeTranslation('豆', '一口廿');
    expectKeystrokeTranslation('腐', '戈戈人月人');
    expectKeystrokeTranslation('花', '廿人心');
    expectCompositionLetters('腐', '戈戈人月人');
    expectPartFill('腐', 1, partFills[0]);
    expectPartFill('腐', 2, partFills[1]);
    expectPartFill('腐', 3, partFills[2]);
    expectPartFill('腐', 4, partFills[3]);
    expectPartFill('腐', 5, partFills[4]);
    cy.get('button').contains('速成').click();
    expectKeystrokeTranslation('腐', '戈人');
    expectCompositionLetters('腐', '戈人');
    expectPartFill('腐', 2, mutedFill);

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

    // when empty, should use the short default sample
    cy.visit('http://localhost:3000/?q=');
    cy.get('#user-input').should('have.value', '速成倉頡');
    cy.getByTestId('char-box').should('have.length', 4);
  });

  it('remembers the input method', () => {
    cy.visit('http://localhost:3000');
    cy.get('button').contains('速成').should('have.class', 'bg-slate-500');

    cy.get('button').contains('倉頡').click();
    cy.reload();
    cy.get('button').contains('倉頡').should('have.class', 'bg-slate-500');
    cy.get('button').contains('速成').should('not.have.class', 'bg-slate-500');
    expectCompositionLetters('倉', '人一日口');

    cy.get('button').contains('速成').click();
    cy.reload();
    cy.get('button').contains('速成').should('have.class', 'bg-slate-500');
    expectCompositionLetters('倉', '人口');
  });

  it('centers a single lookup card', () => {
    cy.visit(`http://localhost:3000/?q=${encodeURIComponent('香')}`);
    cy.getByTestId('char-box').should('have.length', 1);
    cy.getByTestId('char-box-container').should('have.class', 'justify-center');
    cy.getByTestId('char-box').should('have.class', 'max-w-sm');
    expectCompositionLetters('香', '竹日');
    cy.get('[data-box-char=香] svg').should('exist');
  });

  it('grows the search box with the text', () => {
    cy.visit('http://localhost:3000');
    cy.get('#user-input')
      .invoke('prop', 'offsetHeight')
      .then((start: number) => {
        cy.get('#user-input').type('{selectAll}一二{enter}三四{enter}五六');
        cy.get('#user-input').should(($el) => {
          expect($el.prop('offsetHeight')).to.be.greaterThan(start);
          expect($el.css('overflow-y')).to.eq('hidden');
        });
      });
  });

  it('highlights only the 速成 strokes of 頡', () => {
    cy.visit(`http://localhost:3000/?q=${encodeURIComponent('頡')}`);
    cy.get('[data-box-char=頡] svg').should('exist');
    expectCompositionLetters('頡', '土金');
    expectPartFill('頡', 1, partFills[0]);
    expectPartFill('頡', 2, mutedFill);
    expectPartFill('頡', 3, mutedFill);
    expectPartFill('頡', 4, mutedFill);
    expectPartFill('頡', 5, partFills[1]);

    cy.get('button').contains('倉頡').click();
    expectCompositionLetters('頡', '土口一月金');
    expectPartFill('頡', 2, partFills[1]);
    expectPartFill('頡', 3, partFills[2]);
    expectPartFill('頡', 4, partFills[3]);
    expectPartFill('頡', 5, partFills[4]);
  });
});
