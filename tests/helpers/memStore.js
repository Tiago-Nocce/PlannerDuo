// memStore.js — Store em memória que simula a interface do Firestore usada
// pelas funções puras de public/core.js. Serve aos testes de propriedade
// (fast-check + vitest), sem I/O real.
//
// Interface implementada:
//   getDoc(colecao, id) -> objeto|null   (retorna CÓPIA PROFUNDA dos dados)
//   setDoc(colecao, id, dados) -> void    (substitui integralmente o doc)
//   updateDoc(colecao, id, patch) -> void (merge RASO no doc existente)
//
// O store começa vazio. Use `seed(colecao, id, dados)` para pré-popular
// documentos antes de um teste.

/**
 * Clona profundamente um valor JSON-serializável.
 * Garante isolamento: mutar o valor retornado por getDoc não afeta o store,
 * e mutar o objeto passado a setDoc/seed depois não afeta o store.
 * @param {*} valor valor a clonar
 * @returns {*} cópia profunda
 */
function cloneProfundo(valor) {
  if (valor === null || valor === undefined) {
    return valor;
  }
  return JSON.parse(JSON.stringify(valor));
}

/**
 * Cria um novo store em memória vazio.
 * @returns {{
 *   getDoc: (colecao: string, id: string) => (object|null),
 *   setDoc: (colecao: string, id: string, dados: object) => void,
 *   updateDoc: (colecao: string, id: string, patch: object) => void,
 *   seed: (colecao: string, id: string, dados: object) => void,
 *   _dump: () => object
 * }}
 */
function criarMemStore() {
  // Estrutura interna: { [colecao]: { [id]: dados } }
  const dados = Object.create(null);

  function garantirColecao(colecao) {
    if (!dados[colecao]) {
      dados[colecao] = Object.create(null);
    }
    return dados[colecao];
  }

  return {
    getDoc(colecao, id) {
      const col = dados[colecao];
      if (!col || !Object.prototype.hasOwnProperty.call(col, id)) {
        return null;
      }
      return cloneProfundo(col[id]);
    },

    setDoc(colecao, id, doc) {
      const col = garantirColecao(colecao);
      col[id] = cloneProfundo(doc);
    },

    updateDoc(colecao, id, patch) {
      const col = garantirColecao(colecao);
      const atual = col[id] ? cloneProfundo(col[id]) : {};
      col[id] = Object.assign(atual, cloneProfundo(patch));
    },

    // Alias explícito para pré-popular documentos nos testes.
    seed(colecao, id, doc) {
      this.setDoc(colecao, id, doc);
    },

    // Utilitário para inspeção em testes (cópia profunda do estado inteiro).
    _dump() {
      return cloneProfundo(dados);
    },
  };
}

module.exports = { criarMemStore };
