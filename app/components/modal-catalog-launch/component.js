import Ember from 'ember';
import NewOrEdit from 'ui/mixins/new-or-edit';

export default Ember.Component.extend(NewOrEdit, {
  originalModel: null,
  environmentResource: null,

  templateResource: Ember.computed.alias('originalModel'),
  primaryResource: Ember.computed.alias('environmentResource'),
  editing: Ember.computed.notEmpty('primaryResource.id'),

  actions: {
    cancel: function() {
      this.sendAction('dismiss');
    },

    togglePreview: function() {
      if ( this.get('previewOpen') )
      {
        this.highlightAll();
      }

      this.toggleProperty('previewOpen');
    }
  },

  highlightAll: function() {
    this.$('CODE').each(function(idx, elem) {
      Prism.highlightElement(elem);
    });
  },

  versionsArray: null,
  questionsArray: null,
  selectedTemplate: null,
  selectedTemplateModel: null,
  loading: false,
  previewOpen: false,

  setup: Ember.on('init', function() {
    if ( !this.get('environmentResource') )
    {
      this.set('environmentResource', this.get('store').createRecord({
        type: 'environment',
        environment: {},
      }));
    }

    var links = this.get('templateResource.versionLinks');
    var verArr = Object.keys(links).map((key) => {
      return {version: key, link: links[key]};
    });
    this.set('versionsArray', verArr);

    // Select the default version
    var def = this.get('templateResource.version');
    if ( links[def] )
    {
      this.set('selectedTemplateUrl', links[def]);
    }
  }),

  templateChanged: function() {
    var link = this.get('selectedTemplateUrl');
    if ( link )
    {
      this.set('loading', true);

      var current = this.get('environmentResource.environment');
      Ember.$.ajax(link, 'GET').then((response) => {
        if ( response.questions )
        {
          response.questions.forEach((item) => {
            if ( typeof current[item.variable] !== 'undefined' )
            {
              item.answer = current[item.variable];
            }
            else
            {
              item.answer = item.default;
            }
          });
        }

        this.set('selectedTemplateModel', response);
        this.set('loading', false);

        Ember.run.next(() => {
          this.highlightAll();
        });
      }, ( /*error*/ ) => {});
    }
    else
    {
      this.set('selectedTemplateModel', null);
    }
  }.observes('selectedTemplateUrl'),

  validate() {
    var errors = [];

    if ( !this.get('editing') && !this.get('environmentResource.name') )
    {
      errors.push('Name is required');
    }

    if ( this.get('selectedTemplateModel.questions') )
    {
      this.get('selectedTemplateModel.questions').forEach((item) => {
        if ( item.required && item.type !== 'boolean' && !item.answer )
        {
          errors.push(`${item.label} is required`);
        }
      });
    }

    if ( errors.length )
    {
      this.set('errors', errors.uniq());
      this.$().parent().scrollTop(0);
      return false;
    }

    return true;
  },

  willSave() {
    this.set('errors', null);
    var ok = this.validate();
    if ( !ok )
    {
      // Validation failed
      return false;
    }

    var environments = {};
    this.get('selectedTemplateModel.questions').forEach((item) => {
      environments[item.variable] = item.answer;
    });

    this.get('environmentResource').setProperties({
      dockerCompose: this.get('selectedTemplateModel.dockerCompose'),
      rancherCompose: this.get('selectedTemplateModel.rancherCompose'),
      environment: environments,
      externalId: this.get('selectedTemplateModel.uuid')
    });

    return true;
  },

  doSave() {
    if ( this.get('editing') )
    {
      return this.get('environmentResource').doAction('upgrade', {
        dockerCompose: this.get('environmentResource.dockerCompose'),
        rancherCompose: this.get('environmentResource.rancherCompose'),
        environment: this.get('environmentResource.environment'),
        externalId: this.get('selectedTemplateModel.uuid')
      });
    }
    else
    {
      return this._super.apply(this, arguments);
    }
  },

  doneSaving() {
    this.sendAction('dismiss');
    return this.get('router').transitionTo('environment', this.get('primaryResource.id'));
  }

});
