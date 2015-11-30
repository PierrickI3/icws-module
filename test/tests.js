var should = require('should'),
    icws = require('../index.js')

describe('init', function() {
  describe('parameters:', function() {
    it('should fail if no options are passed', function() {
      (function(){ icws.init(); }).should.throw('Missing options');
    });
    it('should fail if no CIC server is passed', function() {
      (function(){ icws.init({cicServer: ''}); }).should.throw('Missing cicServer');
      (function(){ icws.init({}); }).should.throw('Missing cicServer');
    });
    it('should fail if no CIC server port is passed', function() {
      (function(){ icws.init({cicServer: 'test', port: ''}); }).should.throw('Missing port');
      (function(){ icws.init({cicServer: 'test'}); }).should.throw('Missing port');
    });
    it('should succeed', function() {
      (function(){ icws.init({cicServer: 'test', port: '8018'}); }).should.not.throw();
    });
  });
});

describe('query', function() {
  describe('parameters:', function() {
    it('should fail if no method is passed', function() {
      (function(){ icws.query(); }).should.throw();
      (function(){ icws.query({method: ''}); }).should.throw();
    });
    it('should fail if no requestPath is passed', function() {
      (function(){ icws.query({method: 'GET', requestPath: ''}); }).should.throw();
      (function(){ icws.query({method: 'GET'}); }).should.throw();
    });
  });
});

describe('login', function() {
  describe('parameters:', function() {
    it('should fail if no parameters are passed', function() {
      (function(){ icws.login(); }).should.throw('Missing username');
    });
    it('should fail if no username is passed', function() {
      (function(){ icws.login(); }).should.throw('Missing username');
    });
    it('should fail if no password is passed', function() {
      (function(){ icws.login('test'); }).should.throw('Missing password');
    });
  });
  it('should fail to connect to an unknown server', function(done) {
    icws.login('test', '1234', function(statusCode, message) {
      statusCode.should.eql(404);
      done();
    });
  });
  it('should connect to an real server', function(done) {
    icws.init({uriScheme: 'https://', cicServer: 'cic2015r3test.cloudapp.net', port: '8019'})
    icws.login('cicadmin', '1234', function(statusCode, message) {
      statusCode.should.eql(0);
      message.should.have.property('sessionId');
      message.should.have.property('alternateHostList');
      message.should.have.property('userID');
      message.should.have.property('userDisplayName');
      message.should.have.property('icServer');
      done();
    });
  });
  it('should fail to connect with bad credentials', function(done) {
    icws.init({uriScheme: 'https://', cicServer: 'cic2015r3test.cloudapp.net', port: '8019'})
    icws.login('cicadmin2', '1234', function(statusCode, message) {
      statusCode.should.eql(400);
      done();
    });
  });
});

describe('logout', function() {
  it('should succeed', function(done) {
    icws.init({uriScheme: 'https://', cicServer: 'cic2015r3test.cloudapp.net', port: '8019'});
    icws.login('cicadmin', '1234', function(statusCode, message) {
      statusCode.should.eql(0);
      icws.logout(function(statusCode, message) {
        statusCode.should.eql(200);
        done();
      });
    });
  });
  it('should fail (non-existent session)', function(done) {
    //icws.init({uriScheme: 'https://', cicServer: 'cic2015r3test.cloudapp.net', port: '8019'});
    icws.logout(function(statusCode, message) {
      statusCode.should.eql(401);
      done();
    });
  });
});

describe('status', function() {
  it('should get a list of statuses', function(done) {
    icws.init({uriScheme: 'https://', cicServer: 'cic2015r3test.cloudapp.net', port: '8019'});
    icws.login('cicadmin', '1234', function(statusCode, message) {
      statusCode.should.eql(0);
      icws.fetch({
        url: '/status/status-messages',
        icwsOptions: {
          query: [{
            select: 'configurationId,messageText,iconUri,statusId',
            rightsFilter: 'view'
          }]
        },
        success: function(statuses) {
          should.exist(statuses);
          done();
        }
      });
    });
  });
  it('should get current status', function(done) {
    icws.init({uriScheme: 'https://', cicServer: 'cic2015r3test.cloudapp.net', port: '8019'});
    icws.login('cicadmin', '1234', function(statusCode, message) {
      statusCode.should.eql(0);
      icws.fetch({
        url: '/status/user-statuses/cicadmin',
        success: function(status) {
          should.exist(status);
          done();
        }
      });
    });
  });
  it('should fail to get the status of a non-existent user', function(done) {
    icws.init({uriScheme: 'https://', cicServer: 'cic2015r3test.cloudapp.net', port: '8019'});
    icws.login('cicadmin', '1234', function(statusCode, message) {
      statusCode.should.eql(0);
      icws.fetch({
        url: '/status/user-statuses/cicadmin2',
        error: function(status, response) {
          status.should.eql(404);
          done();
        }
      });
    });
  });
})
