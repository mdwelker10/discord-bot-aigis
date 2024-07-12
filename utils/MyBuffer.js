/**
 * Acts as kind of a circular buffer that loops through all values. Length is arbitrary and will increase
 * as data is inserted. Pointer is the current index of the buffer which determines which item is retrieved by get().
 * Also provide a get(idx) method to get a specific index of the buffer.
 * Can pass a string to the constructor to initialize the buffer with a pre-existing buffer. The string must be in the form of the toString() output
 */
class MyBuffer {
  constructor(string = null) {
    if (string) {
      let obj = JSON.parse(string);
      this.length = obj.length;
      this.pointer = obj.pointer;
      this.buffer = obj.buffer;
    } else {
      this.length = 0;
      this.pointer = 0;
      this.buffer = [];
    }
  }

  insert(data) {
    this.buffer.push(data);
    this.length++;
  }

  get() {
    if (this.length === 0)
      return null;
    let data = this.buffer[this.pointer];
    this.pointer = (this.pointer + 1) % this.length;
    return data;
  }

  getByIndex(idx) {
    if (idx < 0 || idx >= this.length)
      return null;
    return this.buffer[idx];
  }

  print() {
    console.log(`Pointer: ${this.pointer}`);
    console.log(`Length: ${this.length}`)
    this.buffer.forEach((data, idx) => console.log(`${idx}: ${data}`));
  }

  /** 
   * Takes a function to run on the array to determine how to remove the value. Function should take 2 arguments. First will be an element
   * in the buffer, second will be an array the arguments passed to remove. The function should return false for elements to be removed. 
   * Pointer is set to pointer % length after removal.
   */
  remove(func, ...arr) {
    this.buffer = this.buffer.filter(data => func(data, arr));
    this.length = this.buffer.length;
    this.pointer = this.pointer % this.length;
  }

  /**
   * outputs JSON.stringify of a new object with fields for the length, pointer, and buffer 
   */
  toString() {
    return JSON.stringify({
      length: this.length,
      pointer: this.pointer,
      buffer: this.buffer
    });
  }
}

module.exports = MyBuffer;