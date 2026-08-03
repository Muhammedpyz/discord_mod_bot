const { createContainerMessage } = require('./utils/uiBuilder');

const payload = createContainerMessage('Test Başlık', 'Test açıklama', '#FF0000', [], [
    { name: 'Field 1', value: 'Value 1' }
]);

const comp = payload.components[0].components[0];
console.log(comp.data ? comp.data.content : comp.content);
console.log("comp is:", comp);
