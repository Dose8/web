'use strict';

var Promise = require('bluebird');
var request = require('request');
var util    = require('util');
var config  = require('../../../config/environment');
var tpb     = require('thepiratebay');

var Plugin = require('../../plugin_handler/plugin_base');

// do some funky date stuff .. extends Date
require('datejs');


var ThepiratebaySource = function( options ) {
  this.metadata = {
    pluginId: 'com.piratebay',               // Unique ID of plugin
    pluginName: 'ThePirateBay',              // Display name of plugin
    pluginType: 'source',                    // 'source', 'downloader', 'player'
    sourceType: 'adhoc',                     // 'adhoc', 'continuous'
    link: 'http://thepiratebay.se',          // Link to provider site
    description: 'General torrent site'      // Description of plugin provider
  };

  return this;
}

ThepiratebaySource.prototype.url = function( url ) {
  return false;
};

ThepiratebaySource.prototype.urlMatches = function( url ) {
  return false;
};

ThepiratebaySource.prototype.search = function( query ) {
  return tpb.search( query, {
      orderBy: 'seeds'
    })
    .then(function( results ) {
      config.logger.info( '[tpb] results: ', results.length );
      return transformResults( results );
    })
    .catch( function(err) {
      config.logger.warn( '[tpb] cant get results:', err );
      return [];
    });
};

ThepiratebaySource.prototype.download = function( url ) {
  return this.url( url );
};


ThepiratebaySource.prototype.getDownloadStatus = function() {
  return [];
}


// private functions

function removeWeirdCharacters( str ) {
  return str.replace( '\xc2','' )
            .replace( '\xa0','\x20' );
}

function transformResults( jsonResults ) {
  return jsonResults.map(function( d ) {
    // uploadDate field and size field needs some transforming
    // uploadDate has some weird special tpb format
    var date;

    try {
      var dateString = removeWeirdCharacters( d.uploadDate )
          .replace( /([0-9]{2}-[0-9]{2})\s([0-9]{4})?/, function( match, g1, g2 ) {
            return g1 + '-' + (g2 ? g2 + ' 00:00' : new Date().toString('yyyy')) + ' ';
          })
          .toLowerCase()
          + '-00:00';


      date = Date.parse( dateString );

      if( date == null ) {
        config.logger.warn( '[tpb] failed to parse entry date: ', dateString );
      }
    } catch( err ) {
      config.logger.warn( '[tpb] failed to parse entry date: ', d.uploadDate );
    }

    return {
      source:        'TPB',
      tpbUploadDate: d.uploadDate,
      tpbId:         d.id,
      tpbCategory:   d.category.name + ':' + d.subcategory.name,
      title:         d.name,
      uploaded:      date,
      category:      d.subcategory.name,
      mediaType:     determineMediaType( d ),
      size:          convertSize( d.size ),
      downloadUrl:   d.magnetLink,
      magnetLink:    d.magnetLink,
      hashString:    d.magnetLink.match( /urn:btih:([a-z0-9]{40})/ )[1],
      peers:         parseInt( d.seeders ) + parseInt( d.leechers ),
      seeders:       parseInt( d.seeders ),
      leechers:      parseInt( d.leechers )
    }
  });
};

function determineMediaType( elem ) {
  switch( elem.category.name + ':' + elem.subcategory.name ) {
    case 'Video:HD - TV shows':
    case 'Video:TV shows':
      return 'tvshow';
      break;
    case 'Video:Movies':
    case 'Video:HD - Movies':
    case 'Video:undefined':
    case 'Video:':
    case 'Video:Anime':
    case 'Video:XXX':
    case 'Porn:Movie clips':
    case 'Porn:':
    case 'Porn:Movies':
    case 'Porn:HD - Movies':
      return 'video';
      break;
    case 'Music':
      return 'audio';
      break;
    default:
      return 'unknown';
      break;
  }
}


var SIZE_MULTIPLIERS = {};

SIZE_MULTIPLIERS.B = 1;
SIZE_MULTIPLIERS.KiB = ( SIZE_MULTIPLIERS.B   * 1024 );
SIZE_MULTIPLIERS.MiB = ( SIZE_MULTIPLIERS.KiB * 1024 );
SIZE_MULTIPLIERS.GiB = ( SIZE_MULTIPLIERS.MiB * 1024 );
SIZE_MULTIPLIERS.TiB = ( SIZE_MULTIPLIERS.GiB * 1024 );
SIZE_MULTIPLIERS.PiB = ( SIZE_MULTIPLIERS.TiB * 1024 );
SIZE_MULTIPLIERS.EiB = ( SIZE_MULTIPLIERS.PiB * 1024 );
SIZE_MULTIPLIERS.ZiB = ( SIZE_MULTIPLIERS.EiB * 1024 );



function convertSize( sizeString ) {
  var split = removeWeirdCharacters( sizeString ).split( ' ' );
  return parseFloat( split[0] ) * SIZE_MULTIPLIERS[ split[1] ];
}




module.exports = ThepiratebaySource;