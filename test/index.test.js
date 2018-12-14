'use strict';

const sinon = require(`sinon`);
const test = require(`ava`);
const proxyquire = require(`proxyquire`).noCallThru();
const tools = require(`@google-cloud/nodejs-repo-tools`);

const mockConfig = require(`./config.test.json`);

function getSample() {
  const config = mockConfig;
  const tableMock = {
    load: sinon.stub().returns(Promise.resolve())
  };
  const datasetMock = {
    table: sinon.stub().returns(tableMock)
  };
  const bigqueryMock = {
    dataset: sinon.stub().returns(datasetMock)
  };
  const BigQueryMock = sinon.stub().returns(bigqueryMock);
  const publisherMock = {
    publish: sinon.stub().returns(Promise.resolve())
  };
  const topicMock = {
    publisher: sinon.stub().returns(publisherMock)
  };
  const pubsubMock = {
    topic: sinon.stub().returns(topicMock)
  };
  const PubSubMock = sinon.stub().returns(pubsubMock);
  const fileMock = {
    save: sinon.stub().returns(Promise.resolve())
  };
  const bucketMock = {
    file: sinon.stub().returns(fileMock)
  };
  const storageMock = {
    bucket: sinon.stub().returns(bucketMock)
  };
  const StorageMock = sinon.stub().returns(storageMock);
  const fsMock = {
    writeFile: sinon.stub().returns(Promise.resolve())
  }                                                   ;
  return {
    program: proxyquire(`../`, {
      './config.json': config,
      '@google-cloud/bigquery': {BigQuery: BigQueryMock},
      '@google-cloud/pubsub': {PubSub: PubSubMock},
      '@google-cloud/storage': {Storage: StorageMock},
      'fs': fsMock,
      'util': {promisify: (req => req)}
    }),
    mocks: {
      config: config,
      BigQuery: BigQueryMock,
      bigquery: bigqueryMock,
      PubSub: PubSubMock,
      pubsub: pubsubMock,
      Storage: StorageMock,
      storage: storageMock,
      fs: fsMock
    }
  };
}

test.beforeEach(tools.stubConsole);
test.afterEach.always(tools.restoreConsole);

test.serial(`should fail without valid pubsub message`, async t => {
  // Initialize mocks
  const sample = getSample();
  const event = {
    data: Buffer.from('invalid_message').toString('base64')
  };
  const expectedMsg = 'No valid message found!';

  // Call function and verify behavior
  await sample.program.launchLighthouse(event);
  t.deepEqual(console.error.firstCall.args, [expectedMsg]);
});

test.serial(`should publish all config ids when called with 'all' message`, async t => {
  // Initialize mocks
  const sample = getSample();
  const event = {
    data: Buffer.from('all').toString('base64')
  };

  // Call function and verify behavior
  await sample.program.launchLighthouse(event);
  t.deepEqual(sample.mocks.pubsub.topic().publisher().publish.callCount, 2);
  t.true(sample.mocks.pubsub.topic.calledWithExactly(sample.mocks.config.pubsubTopicId));
  t.deepEqual(sample.mocks.pubsub.topic().publisher().publish.firstCall.args, [Buffer.from(sample.mocks.config.source[0].id)]);
  t.deepEqual(sample.mocks.pubsub.topic().publisher().publish.secondCall.args, [Buffer.from(sample.mocks.config.source[1].id)]);
});

test.serial(`should call bigquery load for id when called with id in pubsub message`, async t => {
  // Initialize mocks
  const sample = getSample();
  const event = {
    data: Buffer.from(sample.mocks.config.source[0].id).toString('base64')
  };

  // Call function and verify behavior
  await sample.program.launchLighthouse(event);
  t.deepEqual(sample.mocks.storage.bucket().file().save.callCount, 3);
  t.deepEqual(sample.mocks.fs.writeFile.callCount, 1);
  t.deepEqual(sample.mocks.bigquery.dataset().table().load.callCount, 1);
});