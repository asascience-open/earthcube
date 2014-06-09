var pageSize = 20;
var searchStore;
var layersStore;

var map;
var proj3857 = new OpenLayers.Projection("EPSG:3857");
var proj4326 = new OpenLayers.Projection("EPSG:4326");

var searchShadow;
var searchHilite;

function init() {
  searchStore = new Ext.data.Store({
    reader     : new Ext.data.JsonReader({
       idProperty    : 'id'
      ,root          : 'rows'
      ,totalProperty : 'results'
      ,fields        : [
         {name : 'id'}
        ,{name : 'title'}
        ,{name : 'when'}
        ,{name : 'where'}
        ,{name : 'online'}
        ,{name : 'wms'}
        ,{name : 'node'}
      ]
    })
    ,remoteSort : true
    ,baseParams : {start : 1}
    ,proxy      : new Ext.data.MemoryProxy()
    ,listeners  : {
      beforeload : function(sto,opt) {
        search(Ext.getCmp('searchPanel'),sto,Ext.getCmp('searchText').getValue(),opt.params ? opt.params.start : 1);
      }
      ,load : function(sto) {
        searchHilite.removeAllFeatures();
        syncMapWithResults(sto,searchShadow); 
        searchShadow.setVisibility(true);
      }
      ,clear : function(sto) {
        searchHilite.removeAllFeatures();
        syncMapWithResults(sto,searchShadow);
      }
    }
  });

  var searchPanel = {
     id              : 'searchPanel'
    ,layout          : 'fit'
    ,region          : 'center'
    ,items           : new Ext.grid.GridPanel({
       disableSelection : true
      ,store            : searchStore
      ,columns          : [
/*
        new Ext.grid.RowNumberer({
          renderer : function(val,p,record,rowIndex) {
            if (this.rowspan) {
              p.cellAttr = 'rowspan="'+this.rowspan+'"';
            }
            return rowIndex + 1 + record.store.baseParams.start - 1;
          }
        })
*/
        {id : 'title',dataIndex : 'title',header : 'Description'}
        ,{id : 'when',dataIndex : 'when',header : 'When',width : 150,renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            var minT = o.start; 
            var maxT = o.end;
            if (minT != '' && maxT != '') {
              if (isoDateToDate(minT).format('mmm d, yyyy') == isoDateToDate(maxT).format('mmm d, yyyy')) {
                rows.push(isoDateToDate(minT).format('mmm d, yyyy'));
              }
              else if (isoDateToDate(minT).format('yyyy') == isoDateToDate(maxT).format('yyyy')) {
                if (isoDateToDate(minT).format('mmm') == isoDateToDate(maxT).format('mmm')) {
                  rows.push(isoDateToDate(minT).format('mmm d') + ' - ' + isoDateToDate(maxT).format('d, yyyy'));
                }
                else {
                  rows.push(isoDateToDate(minT).format('mmm d') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
                }
              }
              else {
                rows.push(isoDateToDate(minT).format('mmm d, yyyy') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
              }
            }
          });
          return rows.join('<br>');
        }}
        ,{header : 'Download',renderer : function(val,p,rec) {
          if (rec.get('node')) {
            var params = [rec.get('id'),Ext.id()];
            return '<a title="Download data" class="link" href="javascript:addData(\'' + params.join("','") + '\')">' + 'Get data' + '</a>';
          }
        }}
/*
        ,{id : 'where',dataIndex : 'where',header : 'Where',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.west + ',' + o.south + ',' + o.east + ',' + o.north);
          });
          return rows.join('<br>');
        }}
*/
/*
        ,{dataIndex : 'online',header : 'Protocol',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.protocol);
          });
          return rows.join('<br>');
        }}
*/
        ,{dataIndex : 'wms',header : 'WMS',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            var params = [rec.get('id'),o.id];
            rows.push('<a title="Add layer to map" class="link" href="javascript:addWms(\'' + params.join("','") + '\')">' + o.name + '</a>');
          });
          return rows.join('<br>');
        }}
/*
        ,{dataIndex : 'online',header : 'Name',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.name);
          });
          return rows.join('<br>');
        }}
        ,{dataIndex : 'online',header : 'URL',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push('<a target=_blank href="' + o.url + '">link</a>');
          });
          return rows.join('<br>');
        }}
*/
      ]
      ,autoExpandColumn : 'title'
      ,border           : false
      ,loadMask         : true
      ,enableHdMenu     : false
      ,tbar             : [new Ext.ux.form.SearchField({
         emptyText       : 'Enter keywords to find data.'
        ,id              : 'searchText'
        ,border          : false
        ,wrapFocusClass  : ''
        ,disableSelection : true
        ,onTrigger1Click  : function() {
          if(this.hasSearch){
            this.reset();
            // force a reset for emptyText
            this.setRawValue(this.emptyText);
            this.el.addClass(this.emptyClass);
            this.triggers[0].hide();
            this.hasSearch = false;
            searchStore.removeAll();
          }
        }
        ,onTrigger2Click : function() {
          var v = this.getRawValue();
          if (v.length < 1) {
            this.onTrigger1Click();
            return;
          }
          searchStore.load();
          this.hasSearch = true;
          this.triggers[0].show();
        }
        ,listeners : {afterrender : function(cmp) {
          cmp.setValue('temperature');
          cmp.onTrigger2Click();
        }}
      })]
      ,bbar            : new Ext.PagingToolbar({
         pageSize    : pageSize
        ,store       : searchStore
        ,id          : 'searchResultsPagingToolbar'
        ,displayInfo : true
        ,displayMsg  : 'Displaying results {0} - {1} of {2}'
        ,emptyMsg    : 'No results to display'
        // override the following because start is 1-based instead of extjs's 0-based default
        ,moveFirst   : function() {
          this.doLoad(1);
        }
        ,onLoad      : function(store, r, o){
          if (!this.rendered){
            this.dsLoaded = [store, r, o];
            return;
          }
          var p = this.getParams();
          this.cursor = (o.params && o.params[p.start]) ? o.params[p.start] : store.baseParams.start ? store.baseParams.start : 1;
          var d = this.getPageData(), ap = d.activePage, ps = d.pages;

          this.afterTextItem.setText(String.format(this.afterPageText, d.pages));
          this.inputItem.setValue(ap);
          this.first.setDisabled(ap == 1);
          this.prev.setDisabled(ap == 1);
          this.next.setDisabled(ap == ps);
          this.last.setDisabled(ap == ps);
          this.refresh.enable();
          this.updateInfo();
          this.fireEvent('change', this, d);
        }
        ,updateInfo  : function(){
          if (this.displayItem){
            var count = this.store.getCount();
            var msg = count == 0 ?
              this.emptyMsg :
              String.format(
                this.displayMsg,
                this.cursor, this.cursor+count - 1, this.store.getTotalCount()
              );
            this.displayItem.setText(msg);
          }
        }
        ,getPageData : function(){
          var total = this.store.getTotalCount();
          return {
            total : total,
            activePage : Math.ceil((this.cursor+this.pageSize - 1)/this.pageSize),
            pages :  total < this.pageSize ? 1 : Math.ceil(total/this.pageSize)
          };
        }
      })
      ,listeners : {
        mouseover : function(e,t) {
          var row = this.getView().findRowIndex(t);
          if (_.isNumber(row)) {
            searchShadow.setVisibility(true);
            searchHilite.removeAllFeatures();
            var rec = this.getStore().getAt(row);
            if (rec) {
              searchHilite.addFeatures(makeFeatures(rec));
            }
            searchHilite.redraw();
          }
        }
        ,mouseout : function(e,t) {
          var row = this.getView().findRowIndex(t);
          if (_.isNumber(row)) {
            searchShadow.setVisibility(false);
            searchHilite.removeAllFeatures();
            searchHilite.redraw();
          }
        }
      }
    })
    ,listeners : {
      afterrender : function(cmp) {
        cmp.addListener('resize',function(cmp,w) {
          Ext.getCmp('searchText').setWidth(w - 7);
        });
      }
    }
  };

  layersStore = new Ext.data.ArrayStore({
    fields : [
       {name : 'reportId'}
      ,{name : 'wmsId'}
      ,{name : 'name'}
      ,{name : 'status'}
      ,{name : 'reportTitle'}
      ,{name : 'where'}
      ,{name : 'visibility'}
      ,{name : 'accessLinks'}
      ,{name : 'accessOptions'}
      ,{name : 'rank'}
    ]
    ,listeners : {
      add : function(sto) {
        if (sto.getCount() > 0) {
          Ext.getCmp('layersMsg').setText(sto.getCount() + ' active dataset(s)');
        }
      }
      ,remove : function(sto) {
        if (sto.getCount() == 0) {
          Ext.getCmp('layersMsg').setText('No active layers');
        }
      }
    }
  });

  var layerPanel = {
     region   : 'south'
    ,id       : 'layerPanel'
    ,title    : 'My Data'
    ,split    : true
    ,layout   : 'fit'
    ,defaults : {border : false}
    ,items    : [new Ext.grid.GridPanel({
       store            : layersStore
      ,disableSelection : true
      ,columns          : [
        {align : 'center',width : 40,renderer : function(val,p,rec) {
          var params = [rec.get('reportId'),rec.get('wmsId'),rec.get('name')];
          return '<a href="javascript:removeWms(\'' + params.join("','") + '\')">' + '<img class="link" title="Remove layer" src="img/remove.png">' + '</a>';
        }}
        ,{id : 'name',dataIndex : 'name',header : 'Name',renderer : function(val,p,rec) {
          return rec.get('reportTitle') + (!/ext-gen/.test(val) ? ' : ' + val : '');
        }}
        ,{align : 'center',width : 30,dataIndex : 'status',renderer : function(val,p,rec) {
          return '<img ' + (val == 'loading' ? 'title="Loading..."' : '') + ' width=16 height=16 src="img/' + (val == 'loading' ? 'loading.gif' : 'blank.png') + '">';
        }}
        ,{align : 'center',width : 60,dataIndex : 'visibility',renderer : function(val,p,rec) {
          var params = [rec.get('reportId'),rec.get('wmsId'),rec.get('name')];
          if (rec.get('accessLinks')) {
            return '<a target=_blank href="' + rec.get('accessLinks')[0] + '">' + '<img class="link" title="Download data" width=16 height=16 src="img/download.png">' + '</a><br>Download<br>data';
          }
          else {
            return '<a href="javascript:toggleWmsVisibility(\'' + params.join("','") + '\')">' + '<img class="link" title="Show / hide this layer on the map" width=16 height=16 src="img/' + (val == 'visible' ? 'check_box.png' : 'empty_box.png') + '">' + '</a><br>Show<br>on map?';
          }
        }}
      ]
      ,autoExpandColumn : 'name'
      ,hideHeaders      : true
      ,tbar             : [{text : 'Click on a link from your search results to add to your list.'}]
      ,bbar             : ['->',{text : 'No active datasets',id : 'layersMsg'}]
      ,listeners : {
        mouseover : function(e,t) {
          var row = this.getView().findRowIndex(t);
          if (_.isNumber(row)) {
            searchHilite.removeAllFeatures();
            var rec = this.getStore().getAt(row);
            if (rec) {
              searchHilite.addFeatures(makeFeatures(rec));
            }
            searchHilite.redraw();
          }
        }
        ,mouseout : function(e,t) {
          var row = this.getView().findRowIndex(t);
          if (_.isNumber(row)) {
            searchHilite.removeAllFeatures();
            searchHilite.redraw();
          }
        }
      }
    })]
  }

  var mapPanel = {
     html      : '<div id="map"></div>'
    ,region    : 'center'
    ,listeners : {
      afterrender : function(p) {
        initMap();
      }
      ,bodyresize : function(p,w,h) {
        var el = document.getElementById('map');
        if (el) {
          el.style.width  = w;
          el.style.height = h;
          map.updateSize();
        }
      }
    }
  };

  new Ext.Viewport({
     layout : 'border'
    ,items  : [ 
      {
        region : 'north'
       ,title  : 'Earthcube'
       ,border : false
      }
      ,searchPanel
      ,{
         layout   : 'border'
        ,id       : 'vizPanel'
        ,width    : 400 
        ,region   : 'east'
        ,border   : false
        ,split    : true
        ,items    : [
           mapPanel
          ,layerPanel
        ]
      }
    ]
    ,listeners : {afterrender : function() {
      Ext.getCmp('layerPanel').setHeight(Ext.getCmp('searchPanel').getHeight() * 0.60);
      Ext.getCmp('vizPanel').doLayout();
    }}
  });
}

function search(cmp,sto,searchText,start) {
  cmp.getEl().mask('<table class="maskText"><tr><td>Loading...&nbsp;</td><td><img src="./lib/ext-3.4.1/resources/images/default/grid/loading.gif"></td></tr></table>');
  sto.removeAll();
  GIAPI.DAB('http://23.21.170.207/bcube-broker-tb-101-beta2/').discover(
    function(result) {
      var data = {
         results : 0
        ,rows    : []
      };
      var paginator = result[0];
      data.results = paginator.resultSet().size;
      var page = paginator.page();
      while (page.hasNext()) {
        var node = page.next();
        var report = node.report();
        data.rows.push({
           id     : report.id
          ,title  : report.description != 'none' ? report.description : report.title
          ,when   : report.when
          ,where  : report.where
          ,online : _.sortBy(report.online,function(o){return o.protocol.toLowerCase()})
          ,wms    : _.sortBy(node.olWMS_Layer(),function(o){return o.name.toLowerCase()})
          ,node   : node.isAccessible() ? node : false
        });
      }
      sto.setBaseParam('start',start ? start : 1);
      sto.loadData(data);
      cmp.getEl().unmask();
    }
    ,{
      what : searchText
    }
    ,{
       start    : start
      ,pageSize : pageSize
    }
  );
}

function initMap() {
  searchShadow = new OpenLayers.Layer.Vector(
     'Search shadow'
    ,{styleMap : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(
        OpenLayers.Util.applyDefaults({
           fillOpacity   : 0
          ,strokeWidth   : 1
          ,strokeColor   : '#888888'
          ,strokeOpacity : 1
        })
      )
    })}
  );

  searchHilite = new OpenLayers.Layer.Vector(
     'Search hilite'
    ,{styleMap : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(
        OpenLayers.Util.applyDefaults({
           fillOpacity   : 0.45
          ,fillColor     : '#ffffff'
          ,strokeWidth   : 1
          ,strokeColor   : '#0000ff'
          ,strokeOpacity : 1
          ,label         : "${title}"
          ,fontColor     : '#000000'
          ,fontSize      : '11px'
          ,fontFamily    : 'arial'
          ,fontWeight    : 'bold'
        })
      )
    })}
  );

  map = new OpenLayers.Map('map',{
    layers            : [
      new OpenLayers.Layer.XYZ(
         'ESRI Ocean'
        ,'http://services.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/${z}/${y}/${x}.jpg'
        ,{
           sphericalMercator : true
          ,isBaseLayer       : true
          ,wrapDateLine      : true
        }
      )
      ,searchShadow
      ,searchHilite
    ]
    ,controls          : [
       new OpenLayers.Control.Navigation()
      ,new OpenLayers.Control.MousePosition({displayProjection : proj4326})
      ,new OpenLayers.Control.ZoomPanel()
    ]
    ,projection        : proj3857
    ,displayProjection : proj4326
    ,units             : 'm'
    ,maxExtent         : new OpenLayers.Bounds(-20037508,-20037508,20037508,20037508.34)
    ,center            : new OpenLayers.LonLat(0,0)
    ,zoom              : 0
  });

  map.events.register('addlayer',this,function(e) {
    layersStore.add(new layersStore.recordType({
       reportId      : e.layer.attributes.reportId
      ,wmsId         : e.layer.attributes.wmsId
      ,name          : e.layer.name
      ,status        : (e.layer.attributes.accessLinks ? e.layer.attributes.accessLinks : 'loading')
      ,reportTitle   : e.layer.attributes.reportTitle
      ,where         : e.layer.attributes.where
      ,visibility    : 'visible'
      ,accessLinks   : e.layer.attributes.accessLinks
      ,accessOptions : e.layer.attributes.accessOptions
      ,rank          : e.layer.attributes.accessLinks ? 1 : 0
    }));
    layersStore.sort(
       [{field : 'rank'},{field : 'reportTitle'},{field : 'name'}]
      ,'ASC'
    );
    if (!e.layer.isBaseLayer) {
      map.setLayerIndex(e.layer,map.layers.length - countTopLayers() - 1);
    }
  });
  map.events.register('removelayer',this,function(e) {
    var idx = layersStore.findBy(function(rec) {
      return rec.get('reportId') == e.layer.attributes.reportId && rec.get('wmsId') == e.layer.attributes.wmsId;
    });
    if (idx >= 0) {
      layersStore.removeAt(idx);
    }
  });
}

function syncMapWithResults(sto,lyr) {
  var features = [];
  sto.each(function(rec) {
    features = features.concat(makeFeatures(rec));
  });
  lyr.removeFeatures(lyr.features);
  lyr.addFeatures(features);
  lyr.redraw();
}

function makeFeatures(rec) {
  var features = [];
  _.each(rec.get('where'),function(o) {
    o.west = o.west <= -179 ? -178 : o.west;
    o.south = o.south <= -89 ? -88 : o.south;
    o.east = o.east >= 179 ? 178 : o.east;
    o.north = o.north >= 89 ? 88 : o.north;
    var g = {
       type        : 'Polygon'
      ,coordinates : [[
         [o.west,o.south]
        ,[o.east,o.south]
        ,[o.east,o.north]
        ,[o.west,o.north]
        ,[o.west,o.south]
      ]]
    };
    var geojson = new OpenLayers.Format.GeoJSON();
    var f       = geojson.read({
       type     : 'FeatureCollection'
      ,features : [{
         type       : 'Feature'
        ,geometry   : g
        ,properties : {
          title : wordwrap((rec.get('title') ? rec.get('title') : ''),20,"\n")
        }
      }]
    });
    f[0].geometry.transform(proj4326,proj3857);
/*
    // change geometry from polygon to line
    if (f[0].geometry.getArea() == 0) {
      f[0].geometry = f[0].geometry.getVertices()[0];
    }
    else {
      var vertices = f[0].geometry.getVertices();
      vertices.push(vertices[0]);
      f[0].geometry = new OpenLayers.Geometry.LineString(vertices);
    }
*/
    features.push(f[0]);
  });
  return features;
}

function toggleWmsVisibility(reportId,wmsId,name) {
  _.each(map.getLayersByName(name),function(o) {
    if (o.attributes.reportId == reportId && o.attributes.wmsId == wmsId) {
      o.setVisibility(!o.visibility);
    }
  });
/*
  searchShadow.setVisibility(false);
  searchHilite.removeAllFeatures();
  searchHilite.redraw();
*/
}

function removeWms(reportId,wmsId,name) {
  _.each(map.getLayersByName(name),function(o) {
    if (o.attributes.reportId == reportId && o.attributes.wmsId == wmsId) {
      map.removeLayer(o);
    }
  });
  searchShadow.setVisibility(false);
  searchHilite.removeAllFeatures();
  searchHilite.redraw();
}

function addData(reportId,wmsId,reportTitle) { 
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    // check to see if it's been added already
    var lyrIdx = layersStore.findBy(function(rec) {
      return rec.get('reportId') == reportId && rec.get('wmsId') == wmsId;
    });
    if (lyrIdx >= 0) {
      Ext.Msg.alert('Error',"We're sorry, but you have already added this dataset to your list.");
      return false;
    }
    else {
      var lyr = new OpenLayers.Layer.Image(
         wmsId
        ,'img/blank.png'
        ,new OpenLayers.Bounds(0,0,0,0)
        ,new OpenLayers.Size(10,10)
      );

      var rec = searchStore.getAt(searchIdx);
      if (!lyr.attributes) {
        lyr.attributes = {};
      }
      lyr.attributes.reportId    = reportId;
      lyr.attributes.wmsId       = wmsId;
      lyr.attributes.reportTitle = rec.get('title');
      lyr.attributes.where       = rec.get('where');

      var node = rec.get('node');
      node.accessOptions(function(resp) {
        lyr.attributes.accessOptions = resp;
        node.accessLink(function(resp) {
          lyr.attributes.accessLinks = resp;
          map.addLayer(lyr);
        },{},true);
      },true);
    }
  }
}

function addWms(reportId,wmsId) {
  searchShadow.setVisibility(false);
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    // check to see if it's been added already
    var lyrIdx = layersStore.findBy(function(rec) {
      return rec.get('reportId') == reportId && rec.get('wmsId') == wmsId;
    });
    if (lyrIdx >= 0) {
      Ext.Msg.alert('Error',"We're sorry, but you have already added this layer to your map.");
      return false;
    }
    else {
      var lyr = _.findWhere(searchStore.getAt(searchIdx).get('wms'),{id : wmsId});

      var rec = searchStore.getAt(searchIdx);
      if (!lyr.attributes) {
        lyr.attributes = {};
      }
      lyr.attributes.reportId    = reportId;
      lyr.attributes.wmsId       = wmsId;
      lyr.attributes.reportTitle = rec.get('title');;
      lyr.attributes.where       = rec.get('where');

      lyr.events.register('loadstart',this,function(e) {
        var idx = layersStore.findBy(function(rec) {
          return rec.get('reportId') == e.object.attributes.reportId && rec.get('wmsId') == e.object.attributes.wmsId;
        });
        if (idx >= 0) {
          var rec = layersStore.getAt(idx);
          rec.set('status','loading');
          rec.commit();
        }
      });
      lyr.events.register('loadend',this,function(e) {
        var idx = layersStore.findBy(function(rec) {
          return rec.get('reportId') == e.object.attributes.reportId && rec.get('wmsId') == e.object.attributes.wmsId;
        });
        if (idx >= 0) {
          var rec = layersStore.getAt(idx);
          rec.set('status','');
          rec.commit();
        }
      });
      lyr.events.register('visibilitychanged',this,function(e) {
        var idx = layersStore.findBy(function(rec) {
          return rec.get('reportId') == e.object.attributes.reportId && rec.get('wmsId') == e.object.attributes.wmsId;
        });
        if (idx >= 0) {
          var rec = layersStore.getAt(idx);
          rec.set('visibility',e.object.visibility ? 'visible' : 'invisible');
          rec.commit();
        }
      });

      map.addLayer(lyr);
    }
  }
}

function countTopLayers() {
  return 2;
}

function isoDateToDate(s) {
  // 2010-01-01T00:00:00Z
  s = s.replace("\n",'');
  var p = s.split('T');
  if (p.length == 2) {
    var ymd = p[0].split('-');
    var hm = p[1].split(':');
    return new Date(
       ymd[0]
      ,ymd[1] - 1
      ,ymd[2]
      ,hm[0]
      ,hm[1]
    );
  }
  else {
    return false;
  }
}

// http://james.padolsey.com/javascript/wordwrap-for-javascript/
function wordwrap(str,width,brk,cut) {
  brk = brk || '\n';
  width = width || 75;
  cut = cut || false;

  if (!str) { return str; }
 
  var regex = '.{1,' +width+ '}(\\s|$)' + (cut ? '|.{' +width+ '}|.+$' : '|\\S+?(\\s|$)');
 
  return str.match( RegExp(regex, 'g') ).join( brk );
}
