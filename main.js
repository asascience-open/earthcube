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
        ,{name : 'vec'}
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
      ,hideHeaders      : true
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
        {id : 'title',dataIndex : 'title',header : 'Description',renderer : function(val,p,rec) {
          var title = val;

          val = rec.get('when');
          var when = [];
          _.each(val,function(o) {
            var minT = o.start;
            var maxT = o.end;
            if (minT != '' && maxT != '') {
              if (isoDateToDate(minT).format('mmm d, yyyy') == isoDateToDate(maxT).format('mmm d, yyyy')) {
                when.push(isoDateToDate(minT).format('mmm d, yyyy'));
              }
              else if (isoDateToDate(minT).format('yyyy') == isoDateToDate(maxT).format('yyyy')) {
                if (isoDateToDate(minT).format('mmm') == isoDateToDate(maxT).format('mmm')) {
                  when.push(isoDateToDate(minT).format('mmm d') + ' - ' + isoDateToDate(maxT).format('d, yyyy'));
                }
                else {
                  when.push(isoDateToDate(minT).format('mmm d') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
                }
              }
              else {
                when.push(isoDateToDate(minT).format('mmm d, yyyy') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
              }
            }
          });

          return title + '<br>'
            + '<p>' + when.join('<br>') + '</p>';
 
        }}
        ,{renderer : function(val,p,rec) {
          var val = rec.get('wms');
          var wms = [];
          _.each(val,function(o) {
            var params = [rec.get('id'),o];
            wms.push('<a title="Add layer to map" class="link" href="javascript:addWms(\'' + params.join("','") + '\')">' + '<img width=8 height=8 title="Add layer to map" class="link" src="img/plus.png">&nbsp;' + o + '</a>');
          });

          val = rec.get('vec');
          var vec = [];
          _.each(val,function(o) {
            var params = [rec.get('id'),o];
            vec.push('<a title="Add layer to map" class="link" href="javascript:addVec(\'' + params.join("','") + '\')">' + '<img width=8 height=8 title="Add layer to map" class="link" src="img/plus.png">&nbsp;' + o + '</a>');
          });

          return wms.concat(vec).join('<br>');
        }}
        ,{align : 'center',width : 60,id : 'where',dataIndex : 'where',renderer : function(val,p,rec) {
          var bounds = new OpenLayers.Bounds();
          _.each(val,function(o) {
            bounds.extend(new OpenLayers.Bounds(o.west,o.south,o.east,o.north));
          });
          bounds.transform(proj4326,proj3857);
          return '<a class="link" title="Zoom to coverage area" href="javascript:map.zoomToExtent(new OpenLayers.Bounds(' + bounds.toString() + '))">' + '<img class="link" title="Zoom to coverage area" src="img/zoom_layer.png">' + '<br>Zoom<br>map</br>';
        }}
        ,{align : 'center',width : 60,renderer : function(val,p,rec) {
          if (rec.get('node')) {
            var params = [rec.get('id'),Ext.id()];
            return '<a class="link" title="Download data" href="javascript:addData(\'' + params.join("','") + '\')">' + '<img class="link" title="Download data" width=16 height=16 src="img/download.png">' + '<br>Download<br>data</a>';
          }
        }}
/*
        ,{dataIndex : 'online',header : 'Protocol',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.protocol);
          });
          return rows.join('<br>');
        }}
*/
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
      ,{name : 'lyrId'}
      ,{name : 'name'}
      ,{name : 'status'}
      ,{name : 'reportTitle'}
      ,{name : 'where'}
      ,{name : 'visibility'}
      ,{name : 'isAccessible'}
      ,{name : 'getData'}
      ,{name : 'rank'}
    ]
    ,listeners : {
      add : function(sto) {
        if (sto.getCount() > 0) {
          Ext.getCmp('layersMsg').setText('Displaying datasets ' + 1 + ' - ' + sto.getCount() + ' of ' + sto.getCount());
        }
      }
      ,remove : function(sto) {
        if (sto.getCount() == 0) {
          Ext.getCmp('layersMsg').setText('No datasets to display');
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
          var params = [rec.get('reportId'),rec.get('lyrId'),rec.get('name')];
          return '<a href="javascript:removeWms(\'' + params.join("','") + '\')">' + '<img class="link" title="Remove layer" src="img/remove.png">' + '</a>';
        }}
        ,{id : 'name',dataIndex : 'name',header : 'Name',renderer : function(val,p,rec) {
          return rec.get('reportTitle') + (!/ext-gen/.test(val) ? ' : ' + val : '');
        }}
        ,{align : 'center',width : 30,dataIndex : 'status',renderer : function(val,p,rec) {
          return '<img ' + (val == 'loading' ? 'title="Loading..."' : '') + ' width=16 height=16 src="img/' + (val == 'loading' ? 'loading.gif' : 'blank.png') + '">';
        }}
        ,{align : 'center',id : 'where',width : 40,dataIndex : 'where',renderer : function(val,p,rec) {
          var bounds = new OpenLayers.Bounds();
          _.each(val,function(o) {
            bounds.extend(new OpenLayers.Bounds(o.west,o.south,o.east,o.north));
          });
          bounds.transform(proj4326,proj3857);
          return '<a class="link" title="Zoom to coverage area" href="javascript:map.zoomToExtent(new OpenLayers.Bounds(' + bounds.toString() + '))">' + '<img class="link" title="Zoom to coverage area" src="img/zoom_layer.png">' + '<br>Zoom<br>map</a>';
        }}
        ,{align : 'center',width : 60,dataIndex : 'visibility',renderer : function(val,p,rec) {
          var params = [rec.get('reportId')];
          if (rec.get('isAccessible')) {
            return '<a target=_blank class="link" title="Download link" href="' + rec.get('getData') + '">' + '<img class="link" title="Download link" width=16 height=16 src="img/download.png">' + '<br>Download<br>link</a>';
          }
          else {
            return '<a class="link" title="Show / hide this layer on the map" href="javascript:toggleWmsVisibility(\'' + params.join("','") + '\')">' + '<img class="link" title="Show / hide this layer on the map" width=16 height=16 src="img/' + (val == 'visible' ? 'check_box.png' : 'empty_box.png') + '">' + '<br>Show<br>on map?</a>';
          }
        }}
      ]
      ,autoExpandColumn : 'name'
      ,hideHeaders      : true
      ,tbar             : [{text : 'Click on a link from your search results to add to your list.'}]
      ,bbar             : ['->',{text : 'No datasets to display',id : 'layersMsg'}]
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
          ,wms    : _.pluck(_.sortBy(node.olWMS_Layer(),function(o){return o.name.toLowerCase()}),'name')
          ,vec    : _.sortBy(node.has_olVector_Layer(),function(o){return o.toLowerCase()})
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
          ,strokeWidth   : '${getStrokeWidth}'
          ,strokeColor   : '#0000ff'
          ,strokeOpacity : 1
          ,label         : "${title}"
          ,fontColor     : '#000000'
          ,fontSize      : '11px'
          ,fontFamily    : 'arial'
          ,fontWeight    : 'bold'
        })
        ,{
          context : {
            getStrokeWidth : function(f) {
              // Thicken up border if the bbox is tiny compared to the map.
              return (f.geometry.getArea() / map.getExtent().toGeometry().getArea()) < 0.000001 ? 10 : 1;
            }
          }
        }
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
      ,lyrId         : e.layer.attributes.lyrId
      ,name          : e.layer.name
      ,status        : (e.layer.attributes.isAccessible ? e.layer.attributes.isAccessible : 'loading')
      ,reportTitle   : e.layer.attributes.reportTitle
      ,where         : e.layer.attributes.where
      ,visibility    : 'visible'
      ,isAccessible  : e.layer.attributes.isAccessible
      ,getData       : '#'
      ,rank          : e.layer.attributes.isAccessible ? 1 : 0
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
      return rec.get('reportId') == e.layer.attributes.reportId && rec.get('lyrId') == e.layer.attributes.lyrId;
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
          title : wordwrap((rec.get('title') ? rec.get('title').substr(0,100) + (rec.get('title').length > 100 ? '...' : '') : ''),20,"\n")
        }
      }]
    });
    f[0].geometry.transform(proj4326,proj3857);
    features.push(f[0]);
  });
  return features;
}

function toggleWmsVisibility(reportId,lyrId,name) {
  _.each(map.getLayersByName(name),function(o) {
    if (o.attributes.reportId == reportId && o.attributes.lyrId == lyrId) {
      o.setVisibility(!o.visibility);
    }
  });
}

function removeWms(reportId,lyrId,name) {
  _.each(map.getLayersByName(name),function(o) {
    if (o.attributes.reportId == reportId && o.attributes.lyrId == lyrId) {
      map.removeLayer(o);
    }
  });
  searchShadow.setVisibility(false);
  searchHilite.removeAllFeatures();
  searchHilite.redraw();
}

function addData(reportId,lyrId) {
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    // check to see if it's been added already
    var lyrIdx = layersStore.findBy(function(rec) {
      return rec.get('reportId') == reportId && rec.get('lyrId') == lyrId;
    });
    if (lyrIdx >= 0) {
      Ext.Msg.alert('Error',"We're sorry, but you have already added this dataset to your list.");
      return false;
    }
    else {
      var lyr = new OpenLayers.Layer.Image(
         lyrId
        ,'img/blank.png'
        ,new OpenLayers.Bounds(0,0,0,0)
        ,new OpenLayers.Size(10,10)
      );

      var rec = searchStore.getAt(searchIdx);
      if (!lyr.attributes) {
        lyr.attributes = {};
      }
      lyr.attributes.reportId     = reportId;
      lyr.attributes.lyrId        = lyrId;
      lyr.attributes.reportTitle  = rec.get('title');
      lyr.attributes.where        = rec.get('where');
      lyr.attributes.isAccessible = rec.get('node').isAccessible();

      map.addLayer(lyr);
      getData(reportId,lyrId);
    }
  }
}

function addVec(reportId,lyrName) {
  searchShadow.setVisibility(false);
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    // check to see if it's been added already
    var lyrIdx = layersStore.findBy(function(rec) {
      return rec.get('reportId') == reportId && rec.get('name') == lyrName;
    });
    if (lyrIdx >= 0) {
      Ext.Msg.alert('Error',"We're sorry, but you have already added this layer to your map.");
      return false;
    }
    else {
      searchStore.getAt(searchIdx).get('node').olVector_Layer(function(resp) {
        var lyr = _.findWhere(resp,{name : lyrName});

        lyr.projection = proj4326;
        lyr.styleMap   = new OpenLayers.StyleMap({
          'default' : new OpenLayers.Style(
            OpenLayers.Util.applyDefaults({
               fillOpacity   : 0
              ,strokeWidth   : 3
              ,strokeColor   : '#ff0000'
              ,strokeOpacity : 1
            })
          )
        });

        var rec = searchStore.getAt(searchIdx);
        if (!lyr.attributes) {
          lyr.attributes = {};
        }
        lyr.attributes.reportId    = reportId;
        lyr.attributes.lyrId       = lyr.id;
        lyr.attributes.reportTitle = rec.get('title');;
        lyr.attributes.where       = rec.get('where');

        lyr.events.register('loadstart',this,function(e) {
          var idx = layersStore.findBy(function(rec) {
            return rec.get('reportId') == e.object.attributes.reportId && rec.get('lyrId') == e.object.attributes.lyrId;
          });
          if (idx >= 0) {
            var rec = layersStore.getAt(idx);
            rec.set('status','loading');
            rec.commit();
          }
        });
        lyr.events.register('loadend',this,function(e) {
          var idx = layersStore.findBy(function(rec) {
            return rec.get('reportId') == e.object.attributes.reportId && rec.get('lyrId') == e.object.attributes.lyrId;
          });
          if (idx >= 0) {
            var rec = layersStore.getAt(idx);
            rec.set('status','');
            rec.commit();
          }
        });
        lyr.events.register('visibilitychanged',this,function(e) {
          var idx = layersStore.findBy(function(rec) {
            return rec.get('reportId') == e.object.attributes.reportId && rec.get('lyrId') == e.object.attributes.lyrId;
          });
          if (idx >= 0) {
            var rec = layersStore.getAt(idx);
            rec.set('visibility',e.object.visibility ? 'visible' : 'invisible');
            rec.commit();
          }
        });

        map.addLayer(lyr);
      },true);
    }
  }
}

function addWms(reportId,lyrName) {
  searchShadow.setVisibility(false);
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    // check to see if it's been added already
    var lyrIdx = layersStore.findBy(function(rec) {
      return rec.get('reportId') == reportId && rec.get('name') == lyrName;
    });
    if (lyrIdx >= 0) {
      Ext.Msg.alert('Error',"We're sorry, but you have already added this layer to your map.");
      return false;
    }
    else {
      var lyr = _.findWhere(searchStore.getAt(searchIdx).get('node').olWMS_Layer(),{name : lyrName});
      var rec = searchStore.getAt(searchIdx);
      if (!lyr.attributes) {
        lyr.attributes = {};
      }
      lyr.attributes.reportId    = reportId;
      lyr.attributes.lyrId       = lyr.id;
      lyr.attributes.reportTitle = rec.get('title');;
      lyr.attributes.where       = rec.get('where');

      lyr.events.register('loadstart',this,function(e) {
        var idx = layersStore.findBy(function(rec) {
          return rec.get('reportId') == e.object.attributes.reportId && rec.get('lyrId') == e.object.attributes.lyrId;
        });
        if (idx >= 0) {
          var rec = layersStore.getAt(idx);
          rec.set('status','loading');
          rec.commit();
        }
      });
      lyr.events.register('loadend',this,function(e) {
        var idx = layersStore.findBy(function(rec) {
          return rec.get('reportId') == e.object.attributes.reportId && rec.get('lyrId') == e.object.attributes.lyrId;
        });
        if (idx >= 0) {
          var rec = layersStore.getAt(idx);
          rec.set('status','');
          rec.commit();
        }
      });
      lyr.events.register('visibilitychanged',this,function(e) {
        var idx = layersStore.findBy(function(rec) {
          return rec.get('reportId') == e.object.attributes.reportId && rec.get('lyrId') == e.object.attributes.lyrId;
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

function getData(reportId,lyrId) {
  var searchIdx = searchStore.findExact(reportId);
  if (searchIdx >= 0) {
    var node = searchStore.getAt(searchIdx).get('node');
    node.accessOptions(function(resp) {
      var data = [];
      _.each(resp,function(accessOptions) {
        _.each(_.sortBy(accessOptions.validOptions,function(o){return o.name.toLowerCase() + o.crs.toLowerCase() + o.rasterFormat.toLowerCase()}),function(o) {
          data.push([
             data.length
            ,accessOptions.defaultOptions
            ,o.name
            ,o.crs
            ,o.linkage
            ,o.protocol
            ,o.rasterFormat
            ,o.resampling
            ,o.subsetting
            ,[o.name,o.crs,o.rasterFormat].join(', ')
          ]);
        });
      });

      var sto = new Ext.data.ArrayStore({
         fields : ['id','defaultOptions','name','crs','linkage','protocol','rasterFormat','resampling','subsetting','lbl']
        ,data   : data
      });

      var win = new Ext.Window({
         title           : 'Build download link'
        ,layout          : 'fit'
        ,width           : 345
        ,height          : 400
        ,constrainHeader : true
        ,modal           : true
        ,items           : new Ext.FormPanel({
           bodyStyle      : 'padding:6'
          ,defaults       : {border : false,width : 200}
          ,labelSeparator : ''
          ,id             : 'downloadParamGridTable'
          ,items          : [
            new Ext.form.ComboBox({
               store          : sto
              ,id             : 'presets'
              ,forceSelection : true
              ,triggerAction  : 'all'
              ,selectOnFocus  : true
              ,mode           : 'local'
              ,displayField   : 'lbl'
              ,valueField     : 'id'
              ,fieldLabel     : 'Presets'
              ,listWidth      : 300
              ,listeners      : {select : function(cmp,rec) {
                _.each(['name','crs','rasterFormat'],function(o) {
                  Ext.getCmp(o).setValue(rec.get(o));
                });
                _.each(['west','south','east','north','from','to'],function(o) {
                  rec.get('subsetting') ? Ext.getCmp(o).enable() : Ext.getCmp(o).disable();
                });
                _.each(['lonResolution','latResolution'],function(o) {
                  rec.get('resampling') ? Ext.getCmp(o).enable() : Ext.getCmp(o).disable();
                });
                _.each(['name','crs','rasterFormat'],function(o) {
                  rec.get('defaultOptions')[o] ? Ext.getCmp(o).setValue(rec.get('defaultOptions')[o]) : false;
                });
                _.each(['lonResolution','latResolution'],function(o) {
                  rec.get('defaultOptions').resolution ? Ext.getCmp(o).setValue(rec.get('defaultOptions').resolution[o]) : false;
                });
                _.each(['west','south','east','north'],function(o) {
                  rec.get('defaultOptions').spatialSubset ? Ext.getCmp(o).setValue(rec.get('defaultOptions').spatialSubset[o]) : false;
                });
                _.each(['from','to'],function(o) {
                  rec.get('defaultOptions').temporalSubset ? Ext.getCmp(o).setValue(rec.get('defaultOptions').temporalSubset[o]) : false;
                });
              }}
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Name'
              ,id         : 'name'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'CRS'
              ,id         : 'crs'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Format'
              ,id         : 'rasterFormat'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Min longitude'
              ,id         : 'west'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Min latitude'
              ,id         : 'south'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Max longitude'
              ,id         : 'east'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Max latitude'
              ,id         : 'north'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Longitude res.'
              ,id         : 'lonResolution'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Latitude res.'
              ,id         : 'latResolution'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Time from'
              ,id         : 'from'
              ,disabled   : true
            })
            ,new Ext.form.TextField({
               fieldLabel : 'Time to'
              ,id         : 'to'
              ,disabled   : true
            })
          ]
          ,buttons : [
            {
               text    : 'Cancel'
              ,handler : function() {
                removeWms(reportId,lyrId,lyrId);
                win.close();
              }
            } 
            ,{
               text    : 'OK'
              ,handler : function() {
                node.accessLink(function(resp) {
                  var idx = layersStore.findBy(function(rec) {
                    return rec.get('reportId') == reportId && rec.get('lyrId') == lyrId;
                  });
                  if (idx >= 0) {
                    var rec = layersStore.getAt(idx);
                    rec.set('getData',resp);
                    rec.commit();
                  }
                  win.close();
                }
                ,{
                   crs          : Ext.getCmp('crs').getValue()
                  ,rasterFormat : Ext.getCmp('rasterFormat').getValue()
                });
              }
            }
          ]
          ,listeners : {afterrender : function() {
            if (sto.getCount() > 0) {
              Ext.getCmp('presets').setValue(0);
              Ext.getCmp('presets').fireEvent('select',null,sto.getAt(0));
            }
          }}
        })
      });
      win.show();
    },true);
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
