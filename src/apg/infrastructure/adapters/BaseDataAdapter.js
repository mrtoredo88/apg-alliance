export class BaseDataAdapter {
  constructor(name = 'data-adapter') {
    this.name = name;
  }

  async getDocument() { throw new Error(`${this.name}:getDocument_not_implemented`); }
  async listDocuments() { throw new Error(`${this.name}:listDocuments_not_implemented`); }
  async queryDocuments() { throw new Error(`${this.name}:queryDocuments_not_implemented`); }
  async setDocument() { throw new Error(`${this.name}:setDocument_not_implemented`); }
  async updateDocument() { throw new Error(`${this.name}:updateDocument_not_implemented`); }
  async addDocument() { throw new Error(`${this.name}:addDocument_not_implemented`); }
  async deleteDocument() { throw new Error(`${this.name}:deleteDocument_not_implemented`); }
  async runTransaction() { throw new Error(`${this.name}:runTransaction_not_implemented`); }
}
