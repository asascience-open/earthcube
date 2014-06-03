var pageSize = 15;
var sto;

function init() {
  sto = new Ext.data.Store({
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
      ]
    })
    ,remoteSort : true
    ,baseParams : {start : 1}
    ,proxy      : new Ext.data.MemoryProxy()
    ,listeners  : {beforeload : function(sto,opt) {
      search(Ext.getCmp('gp'),sto,Ext.getCmp('searchText').getValue(),opt.params ? opt.params.start : 1);
    }}
  });

  new Ext.Window({
     title           : 'Search'
    ,id              : 'gp'
    ,layout          : 'fit'
    ,width           : 640
    ,height          : 480
    ,constrainHeader : true
    ,items           : new Ext.grid.GridPanel({
       store   : sto
      ,columns : [
        new Ext.grid.RowNumberer({
          renderer : function(v,p,record,rowIndex) {
            if (this.rowspan) {
              p.cellAttr = 'rowspan="'+this.rowspan+'"';
            }
            return rowIndex + 1 + sto.baseParams.start - 1;
          }
        })
        ,{id : 'title',dataIndex : 'title',header : 'Description'}
        ,{id : 'when',dataIndex : 'when',header : 'When',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            var minT = o.start; 
            var maxT = o.end;
            if (minT != '' && maxT != '') {
              if (isoDateToDate(minT).format('mmm d, yyyy') == isoDateToDate(maxT).format('mmm d, yyyy')) {
                rows.push(isoDateToDate(minT).format('mmm d, yyyy'));
              }
              else if (isoDateToDate(minT).format('yyyy') == isoDateToDate(maxT).format('yyyy')) {
                rows.push(isoDateToDate(minT).format('mmm d') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
              }
              else {
                rows.push(isoDateToDate(minT).format('mmm d, yyyy') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
              }
            }
          });
          return rows.join('<br>');
        }}
        ,{id : 'where',dataIndex : 'where',header : 'Where',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.west + ',' + o.south + ',' + o.east + ',' + o.north);
          });
          return rows.join('<br>');
        }}
        ,{dataIndex : 'online',header : 'Protocol',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.protocol);
          });
          return rows.join('<br>');
        }}
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
      ]
      ,autoExpandColumn : 'title'
      ,border           : false
      ,loadMask         : true
      ,tbar             : [new Ext.ux.form.SearchField({
         emptyText       : 'Enter keywords to find data.'
        ,id              : 'searchText'
        ,width           : 220
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
          }
        }
        ,onTrigger2Click : function() {
          var v = this.getRawValue();
          if (v.length < 1) {
            this.onTrigger1Click();
            return;
          }
          sto.load();
          this.hasSearch = true;
          this.triggers[0].show();
        }
      })]
      ,bbar            : new Ext.PagingToolbar({
         pageSize    : pageSize
        ,store       : sto
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
    })
  }).show();
}

function search(cmp,sto,searchText,start) {
  cmp.getEl().mask('<table class="maskText"><tr><td>Loading...&nbsp;</td><td><img src="./lib/ext-3.4.1/resources/images/default/grid/loading.gif"></td></tr></table>');
  sto.removeAll();
  GIAPI.DAB('http://23.21.170.207/bcube-broker-tb-100/').discover(
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
           id       : report.id
          ,title    : report.description != 'none' ? report.description : report.title
          ,when     : report.when
          ,where    : report.where
          ,online   : _.sortBy(report.online,function(o){return o.protocol.toLowerCase()})
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
