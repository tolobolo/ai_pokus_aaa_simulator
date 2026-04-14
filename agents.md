* a web application with a backend and a frontend.

# notes to agent
- simple program no need to scale up
- code should be understadebal to beginers
- 

# backend
* backend in rust with a common web framework

* expost a api with the following calls
  - list_all_pasients() -> list of pasientsname
  - get_video(pasient_name) -> video
  - get_image(pasient_name) -> image 
  - get_answer() ->  cordinats of two points in the image

* data saved in a folder with a data/pasient_name for every pasient it should be a video a image and a answer


# frontend
* frontend in javascript and html and css
* call the backend api

## page zero
  * show list of pasients
  * click on pasients to show nexst page with data from that pasient
 
## page one
  * show a video 
  * nexst button to go to nexst page 
## page two
  * show a image
  * select two points and make a line beween them 
  * nexst pasient button go back to page zero
  * a reset points button removes the points and result 
  * a show answer button withs calls get_answer and shows data with another color
