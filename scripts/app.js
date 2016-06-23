//Each of the controllers should be moved to separate files for easy readability 
//In the end they will be assembled as a single js file using requireJS and grunt build system
(function($) {
	//Setup dependencies for the module
	var app = angular.module('mysocial', [ 'ngRoute','textAngular','ngWebsocket', 'ngCookies' ]);
	app.run(function($http,$rootScope,$location,$log,$websocket, $cookies, $location) {
		$log.debug("App run...");
		$rootScope.currentPath = $location.path();

		// keep user logged in after page refresh
        var user_authdata = $cookies.get('user_authdata');
        var userName = $cookies.get('userName');
        if (user_authdata) {
            $http.defaults.headers.common['Authorization'] = 'Basic ' + user_authdata; // jshint ignore:line
        }
 		
        $rootScope.$on('$locationChangeStart', function (event, next, current) {
            // redirect to login page if not logged in
            var user_authdata = $cookies.get('user_authdata');
            var userName = $cookies.get('userName');
            console.log($http.defaults.headers.common.Authorization);
            if ($location.path() !== '/login' && $location.path() !== '/register' && !user_authdata && !userName) {
                $location.path('/login');
            }
        });
		// $http.defaults.headers.common.Authorization = 'Basic ' + 'pavan:pavan123';
		/*var isUserLoggedIn = $cookies.get('isUserLoggedIn');
		if($rootScope.currentPath !== '/login' || $rootScope.currentPath !== '/register') {
		if(!isUserLoggedIn) {
			$location.path('/login');
		}
	}
	*/
	});

	//ROUTE configurations for all views
	app.config([ '$routeProvider', function($routeProvider) {
		$routeProvider.when('/', {
			templateUrl : 'templates/appHome.html',
			controller : 'AppHomeController'
		}).when('/login', {
			templateUrl : 'templates/login.html',
			controller : 'LoginController'
		}).when('/register', {
			templateUrl : 'templates/register.html',
			controller : 'LoginController'
		}).when('/newPost', {
			templateUrl : 'templates/BlogEdit.html',
			controller : 'BlogController'
		}).when('/logout', {
			templateUrl : 'templates/logout.html',
			controller : 'LoginController'
		}).otherwise({
			templateUrl : '/login'
		});
	} ]).factory('authHttpResponseInterceptor',
			[ '$q', '$location','$log', function($q, $location, $log) {
				return {
					response : function(response) {
						if (response.status === 401) {
							$log.debug("Response 401");
						}
						return response || $q.when(response);
					},
					responseError : function(rejection) {
						if (rejection.status === 401) {
							$log.debug("Response Error 401", rejection);
							$location.path('/login');
						}
						return $q.reject(rejection);
					}
				}
			} ]).config([ '$httpProvider', function($httpProvider) {
		// Http Intercpetor to check auth failures for xhr requests
		$httpProvider.interceptors.push('authHttpResponseInterceptor');
	} ]);
	//------------------------------------------------------------------------------------------------------------------
	// Controller for the home page with blogs and live users
	//------------------------------------------------------------------------------------------------------------------
	app.controller('AppHomeController', function($http, $log, $scope,
			$rootScope, $websocket, $location, $cookies) {
		var controller = this;
		$log.debug("AppHomeController...");
		$http.get('http://localhost:8084/Services/rest/blogs').success(
				function(data, status, headers, config) {
					$scope.blogs = data;
					$scope.loading = false;
				}).error(function(data, status, headers, config) {
					$scope.loading = false;
					$scope.error = status;
				});
		var ws=null;
		$http.get('http://localhost:8084/Services/rest/user?signedIn=true').success(
			function(data, status, headers, config) {
				$scope.connectedUsers = data;
				console.log("connectedUsers");
				console.log(data);
				/*$cookies.put('isUserLoggedIn', true);
				$cookies.put('userName', data.userName);*/
				$scope.userName = data.userName;
				$scope.userFirst = data.first;
				$scope.userLast = data.last;
				var userObj = {
                    userName: data.userName,
                    userFirst: data.first,
                    userLast: data.last,
                    userId: data._id
                };
                getSignedInUsers();
                var webSocketUserObj = {
                    name: data.userName,
                    first: data.first,
                    fast: data.last,
                    id: data._id
                };
                $cookies.put('userObj', JSON.stringify(userObj));
				$scope.loading = false;
				
			}).error(function(data, status, headers, config) {
				console.log("Error");
				console.log(data);
				$scope.loading = false;
				$scope.error = status;
			});

			// get all signedIn users
			function getSignedInUsers() {
				$http.get('http://localhost:8084/Services/rest/getSignedInUsers').success(function(data, status, headers, config){
					$scope.connectedUsers = data;
					//Setup a websocket connection to server using current host
					ws = $websocket.$new('ws://localhost'+':'+ 5002); // instance of ngWebsocket, handled by $websocket service
					$log.debug("Web socket established...");
			        ws.$on('$open', function () {
			            $log.debug('Socket is open');
			           // ws.$emit('UserLogin', webSocketUserObj); // register the user first
			        });		        

			        ws.$on('$message', function(data){
			        	 $log.debug('The websocket server has sent the following data:');
			        	 $log.debug(data);
			        	 data = JSON.parse(data);
			        	 if(data.event==="UserLogin"){
			        		 //Add this user to list of users
			        		 var found = false;
			        		 for(var index in $scope.connectedUsers){
			        			 if($scope.connectedUsers[index] == data.data.id){
			        				 found=true;
			        			 }
			        		 }
			        		 console.log($scope.connectedUsers);
			        		 if(!found){
			        			 $log.debug("Adding user to list: " + data.data.first);
			        			 $scope.connectedUsers.push(data.data);
			        			 $scope.$digest();
			        		 }
			        	 }else if(data.event==="chatMessage"){
			        		 //Make sure chat window opensup
			        		 $scope.showChat=true
			        		 $log.debug("Updating chat message: ");
			        		 $log.debug(data.data);
			        		 if($scope.chatMessages===undefined)
			        			 $scope.chatMessages=[];
			        		 $scope.chatMessages.push(data);
			        		 $log.debug("Chat Messages: ");
			        		 $log.debug($scope.chatMessages);
			        		 $scope.$digest();
			        	 }
			        });
			        ws.$on('$close', function () {
			            console.log('Web socket closed');
			            ws.$close();
			        });
				}).error(function(data, status, headers, config) {
					console.log("Chat Error");
					console.log(data);
					$scope.loading = false;
					$scope.error = status;
				});
			};
			$scope.tagSearch = function(){
				$http.get('http://localhost:8084/Services/rest/blogs/'+$scope.searchTag).success(
					function(data, status, headers, config) {
						console.log(data);
						$scope.blogs = data;
						$scope.loading = false;
					}).error(function(data, status, headers, config) {
						$scope.loading = false;
						$scope.error = status;
					});
				};
			$scope.submitComment = function(comment, blogId){
				//var blogId = comment.blogId;
				$scope.comment = {};
				$scope.comment.content = comment.content;
				var userObj = JSON.parse($cookies.get('userObj'));
				$scope.comment.userFirst = userObj.userFirst;
				$scope.comment.userLast = userObj.userLast;
				$scope.comment.date = new Date();
				console.log($scope.comment);
				$http.post('http://localhost:8084/Services/rest/blogs/'+ blogId +'/comments', $scope.comment).success(
					function(data, status, headers, config) {
						$scope.loading = false;
						for(var index in $scope.blogs){
							if($scope.blogs[index]._id==blogId){
								$log.debug("Pushing the added comment to list");
								$scope.blogs[index].comments.push($scope.comment);
								break;
							}
						}
					}).error(function(data, status, headers, config) {
						$scope.loading = false;
						$scope.error = status;
					});
			};
		
			$scope.sendMessage = function(chatMessage){
				$log.debug("Sending "+ chatMessage);
				var message = JSON.parse($cookies.get('userObj')).userFirst + ":" + chatMessage;
				ws.$emit('chatMessage', message); // send a message to the websocket server
				$scope.chatMessage="";
			}
	});
	//------------------------------------------------------------------------------------------------------------------
	// Controller for the login view and the registration screen
	//------------------------------------------------------------------------------------------------------------------
	app.controller('LoginController', function($http, $log, $scope, $location,
			$rootScope, $cookies, $window) {
		// $http.defaults.headers.common['Authorization'] = 'Basic ' + 'pavan:pavan123';
		var controller = this;
		$scope.isLoadingCompanies = true;
		$scope.loginError = false;
		$scope.dismissAlert = function() {
			$scope.loginError = false;
		}
		$http.get('http://localhost:8084/Services/rest/company').success(
			function(data, status, headers, config) {
				$scope.companies = data;
				$scope.isLoadingCompanies = false;
			}).error(function(data, status, headers, config) {
				$scope.isLoadingCompanies = false;
				$scope.error = status;
			});
		$scope.login = function(user) {
			$scope.loginError = false;
			$http.post("http://localhost:8084/Services/rest/user/auth", user).success(
				function(data) {
					$rootScope.loggedIn = true;
					$scope.loginError = false;
					var authdata = window.btoa(data.userName + ':' + data.password);
 
		             $http.defaults.headers.common['Authorization'] = 'Basic ' + authdata; // jshint ignore:line
		             $cookies.put('user_authdata', authdata);
		             $cookies.put('userName', data.userName);
					 $window.location = "/";
				}).error(function(data, status, headers, config) {
					console.log("User Not Found....");
					$scope.loginError = true;
				});
		};
		$scope.logout = function() {
            $cookies.remove('user_authdata');
            $cookies.remove('userName');
            $cookies.remove('userObj');
            $http.post("http://localhost:8084/Services/rest/user/logout").success(
				function(data) {
					$http.defaults.headers.common.Authorization = 'Basic ';
            		$window.location = "/";
				}).error(function(data, status, headers, config) {
					console.log("Logout error..");
					console.log(data);
				});
		};
		$scope.register = function() {
			$log.debug("Navigating to register...");
			$location.path("/register");
		};
		$scope.submitRegister = function(user){
			$log.debug("Registering...");
			console.log(user);
			$http.post("http://localhost:8084/Services/rest/user/register", user).success(
				function(data) {
					$log.debug(data);
					var authdata = window.btoa(data.userName + ':' + data.password);
 
		            $http.defaults.headers.common['Authorization'] = 'Basic ' + authdata; // jshint ignore:line
		            $cookies.put('user_authdata', authdata);
		            $cookies.put('userName', data.userName);
					$location.path("/");
				});
		}
		$scope.companyChange = function(companyId) {
			$log.debug("Loading sites for company: " + companyId);
			// Load sites
			$http.get('http://localhost:8084/Services/rest/company/'+companyId+'/sites').success(
				function(data, status, headers, config) {
					$scope.sites = data;
					console.log($scope.sites);
					$scope.isLoadingSites = false;
				}).error(function(data, status, headers, config) {
					$scope.isLoadingSites = false;
					$scope.error = status;
				});
		};
		
		$scope.siteChange = function(companyId, siteId) {
			$log.debug("Loading departments: " + companyId);
			// Load sites
			$http.get('http://localhost:8084/Services/rest/company/'+companyId+'/sites/'+siteId+'/departments').success(
				function(data, status, headers, config) {
					$scope.departments = data;
					$scope.isLoadingDepts = false;
				}).error(function(data, status, headers, config) {
					$scope.isLoadingDepts = false;
					$scope.error = status;
				});
		};
	});
	//------------------------------------------------------------------------------------------------------------------
	// Controller for the navigation bar.. currently has no functions
	//------------------------------------------------------------------------------------------------------------------
	app.controller('NavbarController',
			function($http, $log, $scope, $rootScope) {
				var controller = this;
				$log.debug("Navbar controller...");

	});

	//------------------------------------------------------------------------------------------------------------------
	// Controller for new blog post view
	//------------------------------------------------------------------------------------------------------------------
	app.controller('BlogController',function($http, $log, $scope, $location, $cookies) {
				var controller = this;
				$log.debug("Blog controller...");
				$scope.blog={};
			    // $scope.data = UserData.data;
			    console.log('userObj cookie');
			    var userObj = JSON.parse($cookies.get('userObj'));
				$scope.blog.userFirst = userObj.userFirst;
				$scope.blog.userLast = userObj.userLast;
				$scope.blog.userId = userObj.userId;
				$scope.blog.date = new Date();
				$scope.blog.content = 'Blog text here...';
				$scope.saveBlog = function(blog){
					console.log(blog);
					$http.post("http://localhost:8084/Services/rest/blogs", blog).success(
						function() {
							$log.debug("Saved blog...");
							$location.path("/");
						});
				};
				$scope.cancel = function(blog){
					$location.path("/");
				};
	});

})($);//Passing jquery object just in case 
