const bacnet  = require('bacstack');
const {store} = require('./background-store');
const settings = {
  deviceId: store.get('deviceId'),
  vendorId: store.get('vendorId'),
}
const client = new bacnet({
  //port: store.get('port'),
});

client.whoIs();

const dataStore = {
  '1:0': {
    75: [{value: {type: 1, instance: 0}, type: 12}],    // PROP_OBJECT_IDENTIFIER
    77: [{value: 'Analog Output 1', type: 7}],          // PROP_OBJECT_NAME
    79: [{value: 1, type: 9}],                          // PROP_OBJECT_TYPE
    85: [{value: 5, type: 4}]                           // PROP_PRESENT_VALUE
  },
  '8:443': {
    75: [{value: {type: 8, instance: 443}, type: 12}],  // PROP_OBJECT_IDENTIFIER
    76: [
      {value: {type: 8, instance: 443}, type: 12},
      {value: {type: 1, instance: 0}, type: 12}
    ],                                                  // PROP_OBJECT_IDENTIFIER
    77: [{value: 'my-device-443', type: 7}],            // PROP_OBJECT_NAME
    79: [{value: 8, type: 9}],                          // PROP_OBJECT_TYPE
    28: [{value: 'Test Device #443', type: 7}]          // PROP_DESCRIPTION
  }
};

client.on('whoIs', (data) => {
  if (data.lowLimit && data.lowLimit > settings.deviceId) return;
  if (data.highLimit && data.highLimit < settings.deviceId) return;
  console.log(`I am ${settings.deviceId}`);
  client.iAmResponse(settings.deviceId, bacnet.enum.Segmentation.SEGMENTATION_BOTH, settings.vendorId);
});

client.on('readProperty', (data) => {
  const object = dataStore[data.request.objectId.type + ':' + data.request.objectId.instance];
  if (!object) return client.errorResponse(data.address, bacnet.enum.ConfirmedServices.SERVICE_CONFIRMED_READ_PROPERTY, data.invokeId, bacnet.enum.ErrorClasses.ERROR_CLASS_OBJECT, bacnet.enum.ErrorCodes.ERROR_CODE_UNKNOWN_OBJECT);
  const property = object[data.request.property.id];
  if (!property) return client.errorResponse(data.address, bacnet.enum.ConfirmedServices.SERVICE_CONFIRMED_READ_PROPERTY, data.invokeId, bacnet.enum.ErrorClasses.ERROR_CLASS_PROPERTY, bacnet.enum.ErrorCodes.ERROR_CODE_UNKNOWN_PROPERTY);
  if (data.request.property.index === 0xFFFFFFFF) {
    client.readPropertyResponse(data.address, data.invokeId, data.request.objectId, data.request.property, property);
  } else {
    const slot = property[data.request.property.index];
    if (!slot) return client.errorResponse(data.address, bacnet.enum.ConfirmedServices.SERVICE_CONFIRMED_READ_PROPERTY, data.invokeId, bacnet.enum.ErrorClasses.ERROR_CLASS_PROPERTY, bacnet.enum.ErrorCodes.ERROR_CODE_INVALID_ARRAY_INDEX);
    client.readPropertyResponse(data.address, data.invokeId, data.request.objectId, data.request.property, [slot]);
  }
});

client.on('writeProperty', (data) => {
  const object = dataStore[data.request.objectId.type + ':' + data.request.objectId.instance];
  if (!object) return client.errorResponse(data.address, data.service, data.invokeId, bacnet.enum.ErrorClasses.ERROR_CLASS_OBJECT, bacnet.enum.ErrorCodes.ERROR_CODE_UNKNOWN_OBJECT);
  let property = object[data.request.property.id];
  if (!property) return client.errorResponse(data.address, data.service, data.invokeId, bacnet.enum.ErrorClasses.ERROR_CLASS_PROPERTY, bacnet.enum.ErrorCodes.ERROR_CODE_UNKNOWN_PROPERTY);
  if (data.request.property.index === 0xFFFFFFFF) {
    property = data.request.value.value;
    client.simpleAckResponse(data.address, data.service, data.invokeId);
  } else {
    let slot = property[data.request.property.index];
    if (!slot) return client.errorResponse(data.address, data.service, data.invokeId, bacnet.enum.ErrorClasses.ERROR_CLASS_PROPERTY, bacnet.enum.ErrorCodes.ERROR_CODE_INVALID_ARRAY_INDEX);
    slot = data.request.value.value[0];
    client.simpleAckResponse(data.address, data.service, data.invokeId);
  }
});

client.on('whoHas', (data) => {
  if (data.lowLimit && data.lowLimit > settings.deviceId) return;
  if (data.highLimit && data.highLimit < settings.deviceId) return;
  if (data.objId) {
    var object = dataStore[data.objId.type + ':' + data.objId.instance];
    if (!object) return;
    client.iHaveResponse(settings.deviceId, {type: data.objId.type, instance: data.objId.instance}, object[77][0].value);
  }
  if (data.objName) {
    // TODO: Find stuff...
    client.iHaveResponse(settings.deviceId, {type: 1, instance: 1}, 'test');
  }
});

client.on('timeSync', (data) => {
  console.log(`${data}`);
  // TODO: Implement
});

client.on('timeSyncUTC', (data) => {
  console.log(`${data}`);
  // TODO: Implement
});

client.on('readPropertyMultiple', (data) => {
  const responseList = [];
  const properties = data.request.properties;
  properties.forEach((property) => {
    if (property.objectId.type === bacnet.enum.ObjectTypes.OBJECT_DEVICE && property.objectId.instance === 4194303) {
      property.objectId.instance = settings.deviceId;
    }
    const object = dataStore[property.objectId.type + ':' + property.objectId.instance];
    if (!object) return; // TODO: Add error
    const propList = [];
    property.properties.forEach((item) => {
      if (item.id === bacnet.enum.PropertyIds.PROP_ALL) {
        for (let key in object) {
          propList.push({property: {id: key, index: 0xFFFFFFFF}, value: object[key]});
        }
        return;
      }
      const prop = object[item.id];
      let content;
      if (!prop) return; // TODO: Add error
      if (item.index === 0xFFFFFFFF) {
        content = prop;
      } else {
        const slot = prop[item.index];
        if (!prop) return; // TODO: Add error
        content = [slot];
      }
      propList.push({property: {id: item.id, index: item.index}, value: content});
    });
    responseList.push({objectId: {type: property.objectId.type, instance: property.objectId.instance}, values: propList});
  });
  client.readPropertyMultipleResponse('192.168.178.255', data.invokeId, responseList);
});
/* 
client.on('writePropertyMultiple', (data) => { 
});

client.on('atomicWriteFile', (data) => {
});

client.on('atomicReadFile', (data) => {
});

client.on('subscribeCOV', (data) => {
});

client.on('subscribeProperty', (data) => {
});

client.on('deviceCommunicationControl', (data) => {
});

client.on('reinitializeDevice', (data) => {
});

client.on('readRange', (data) => {
});

client.on('createObject', (data) => {
});

client.on('deleteObject', (data) => {
});
 */
console.log('Node BACstack Device started');

module.exports = client;