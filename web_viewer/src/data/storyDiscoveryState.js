import {reactive} from 'vue'
// Retain portal choices while visiting a Reader or event and returning in this session.
export const storyDiscoveryState=reactive({series:'',idols:[],unit:'',query:'',language:'',view:'list'})
